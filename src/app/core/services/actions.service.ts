import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Firestore, onSnapshot, setDoc, writeBatch } from '@angular/fire/firestore';
import { LifeAction, ActionStatus, EffortLevel, EnergyLevel, ActionSource } from '../models/action.model';
import { LifeDomain } from '../models/life-domain.model';
import { INITIAL_TOP_THREE_IDS, MOCK_ACTIONS } from '../data/mock-data';
import { AuthService } from './auth.service';
import { FirestoreBootstrapService } from './firestore-bootstrap.service';
import {
  userActionDoc,
  userActionsCollection,
  userTopThreeDoc,
} from '../firebase/firestore-paths';

@Injectable({ providedIn: 'root' })
export class ActionsService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(FirestoreBootstrapService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _actions = signal<LifeAction[]>(
    this.auth.firebaseEnabled ? [] : [...MOCK_ACTIONS]
  );
  private readonly _topThreeIds = signal<string[]>(
    this.auth.firebaseEnabled ? [] : [...INITIAL_TOP_THREE_IDS]
  );
  private readonly _syncReady = signal(!this.auth.firebaseEnabled);
  private unsubscribeActions?: () => void;
  private unsubscribeTopThree?: () => void;
  private readonly pendingActionIds = new Set<string>();

  readonly actions = this._actions.asReadonly();
  readonly topThreeIds = this._topThreeIds.asReadonly();
  readonly syncReady = this._syncReady.asReadonly();

  readonly topThree = computed(() => {
    const ids = this._topThreeIds();
    return ids
      .map((id) => this._actions().find((a) => a.id === id))
      .filter((a): a is LifeAction => !!a && a.status !== 'done' && a.status !== 'parked');
  });

  readonly activeActions = computed(() =>
    this._actions().filter((a) => a.status !== 'done' && a.status !== 'parked')
  );

  readonly parkedActions = computed(() =>
    this._actions().filter((a) => a.status === 'parked')
  );

  readonly doneActions = computed(() =>
    this._actions().filter((a) => a.status === 'done')
  );

  constructor() {
    if (!this.auth.firebaseEnabled || !this.firestore) {
      return;
    }

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.teardownListeners();

      if (!uid) {
        this._actions.set([]);
        this._topThreeIds.set([]);
        this._syncReady.set(false);
        return;
      }

      void this.bootstrap.ensureSeeded(uid).then(() => {
        this.subscribeToUserData(uid);
      });
    });
  }

  getById(id: string): LifeAction | undefined {
    return this._actions().find((a) => a.id === id);
  }

  resetAfterWipe(): void {
    this.pendingActionIds.clear();
    this._actions.set([]);
    this._topThreeIds.set([]);
    this._syncReady.set(true);
  }

  addAction(partial: Omit<LifeAction, 'id'>): LifeAction {
    const action: LifeAction = {
      ...partial,
      id: this.createId('act'),
    };
    this._actions.update((list) => [...list, action]);
    this.trackPending(action.id, () => this.persistAction(action));
    return action;
  }

  addManyFromSuggestions(
    items: Array<{ title: string; domain: LifeDomain; source?: ActionSource }>
  ): LifeAction[] {
    const actions = items.map((item) => ({
      id: this.createId('act'),
      title: item.title,
      domain: item.domain,
      source: item.source ?? ('brain_dump' as const),
      effort: this.inferEffort(item.title),
      energy: this.inferEnergy(item.title),
      status: 'not_started' as const,
      reason: 'Converted from brain dump',
    }));

    if (!actions.length) {
      return [];
    }

    this._actions.update((list) => [...list, ...actions]);
    for (const action of actions) {
      this.pendingActionIds.add(action.id);
    }
    void this.persistActionsBatch(actions).finally(() => {
      for (const action of actions) {
        this.pendingActionIds.delete(action.id);
      }
    });

    return actions;
  }

  addFromSuggestion(
    title: string,
    domain: LifeDomain,
    source: ActionSource = 'brain_dump'
  ): LifeAction {
    return this.addAction({
      title,
      domain,
      source,
      effort: this.inferEffort(title),
      energy: this.inferEnergy(title),
      status: 'not_started',
      reason: 'Converted from brain dump',
    });
  }

  updateStatus(id: string, status: ActionStatus): void {
    this._actions.update((list) =>
      list.map((a) => (a.id === id ? { ...a, status } : a))
    );
    if (status === 'done' || status === 'parked') {
      this._topThreeIds.update((ids) => ids.filter((i) => i !== id));
      void this.persistTopThree();
    }
    const action = this.getById(id);
    if (action) {
      void this.persistAction(action);
    }
  }

  markDone(id: string): void {
    this.updateStatus(id, 'done');
  }

  park(id: string): void {
    this.updateStatus(id, 'parked');
  }

  start(id: string): void {
    this.updateStatus(id, 'in_progress');
  }

  promoteToTopThree(id: string): void {
    const action = this.getById(id);
    if (!action || action.status === 'done' || action.status === 'parked') return;

    this._topThreeIds.update((ids) => {
      if (ids.includes(id)) return ids;
      const next = [...ids, id];
      return next.length > 3 ? next.slice(-3) : next;
    });
    void this.persistTopThree();
  }

  setTopThree(ids: string[]): void {
    this._topThreeIds.set(ids.slice(0, 3));
    void this.persistTopThree();
  }

  removeFromTopThree(id: string): void {
    this._topThreeIds.update((ids) => ids.filter((i) => i !== id));
    void this.persistTopThree();
  }

  getByDomain(domain: LifeDomain): LifeAction[] {
    return this._actions().filter((a) => a.domain === domain);
  }

  getByStatus(status: ActionStatus): LifeAction[] {
    return this._actions().filter((a) => a.status === status);
  }

  private subscribeToUserData(uid: string): void {
    const firestore = this.firestore;
    if (!firestore) {
      return;
    }

    this.unsubscribeActions = onSnapshot(
      userActionsCollection(firestore, uid),
      (snapshot) => {
        const remote = snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as LifeAction
        );
        this.applyRemoteActions(remote);
        this._syncReady.set(true);
      },
      () => this._syncReady.set(true)
    );

    this.unsubscribeTopThree = onSnapshot(
      userTopThreeDoc(firestore, uid),
      (snapshot) => {
        const ids = snapshot.data()?.['ids'];
        if (Array.isArray(ids)) {
          this._topThreeIds.set(ids.slice(0, 3));
        }
      }
    );

    this.destroyRef.onDestroy(() => this.teardownListeners());
  }

  private teardownListeners(): void {
    this.unsubscribeActions?.();
    this.unsubscribeTopThree?.();
    this.unsubscribeActions = undefined;
    this.unsubscribeTopThree = undefined;
  }

  private applyRemoteActions(remote: LifeAction[]): void {
    this._actions.update((local) => {
      const remoteIds = new Set(remote.map((action) => action.id));
      const pending = local.filter(
        (action) => this.pendingActionIds.has(action.id) && !remoteIds.has(action.id)
      );
      return this.dedupeById([...remote, ...pending]);
    });
  }

  private trackPending(id: string, persist: () => Promise<void>): void {
    this.pendingActionIds.add(id);
    void persist().finally(() => this.pendingActionIds.delete(id));
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private dedupeById(actions: LifeAction[]): LifeAction[] {
    const byId = new Map<string, LifeAction>();
    for (const action of actions) {
      byId.set(action.id, action);
    }
    return [...byId.values()];
  }

  private async persistActionsBatch(actions: LifeAction[]): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    const batch = writeBatch(firestore);
    for (const action of actions) {
      const { id, ...data } = action;
      batch.set(userActionDoc(firestore, uid, id), data);
    }
    await batch.commit();
  }

  private async persistAction(action: LifeAction): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    const { id, ...data } = action;
    await setDoc(userActionDoc(firestore, uid, id), data);
  }

  private async persistTopThree(): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    await setDoc(userTopThreeDoc(firestore, uid), {
      ids: this._topThreeIds(),
    });
  }

  private inferEffort(title: string): EffortLevel {
    const lower = title.toLowerCase();
    if (lower.includes('5 min') || lower.includes('quick') || lower.includes('reply')) return '5 min';
    if (lower.includes('90') || lower.includes('build') || lower.includes('complete')) return '90 min';
    if (lower.includes('45') || lower.includes('block') || lower.includes('draft')) return '45 min';
    if (lower.includes('30') || lower.includes('update') || lower.includes('review')) return '30 min';
    return '15 min';
  }

  private inferEnergy(title: string): EnergyLevel {
    const lower = title.toLowerCase();
    if (lower.includes('reply') || lower.includes('reminder') || lower.includes('schedule') || lower.includes('target')) {
      return 'low';
    }
    if (lower.includes('build') || lower.includes('complete') || lower.includes('draft') || lower.includes('revision')) {
      return 'high';
    }
    return 'medium';
  }
}
