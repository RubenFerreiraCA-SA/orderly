import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Firestore, onSnapshot, setDoc, writeBatch } from '@angular/fire/firestore';
import { LifeGoal, GoalStatus } from '../models/goal.model';
import { LifeDomain, LIFE_DOMAINS } from '../models/life-domain.model';
import { MOCK_GOALS } from '../data/mock-data';
import { AuthService } from './auth.service';
import { FirestoreBootstrapService } from './firestore-bootstrap.service';
import { userGoalDoc, userGoalsCollection } from '../firebase/firestore-paths';

export interface GoalSuggestionInput {
  code: string;
  title: string;
  domain: LifeDomain;
  why: string;
  nextAction: string;
  horizon: LifeGoal['horizon'];
}

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(FirestoreBootstrapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingGoalIds = new Set<string>();

  private readonly _goals = signal<LifeGoal[]>(
    this.auth.firebaseEnabled ? [] : [...MOCK_GOALS]
  );
  private unsubscribe?: () => void;

  readonly goals = this._goals.asReadonly();

  readonly activeGoals = computed(() =>
    this._goals().filter((g) => g.status === 'active')
  );

  readonly goalsByDomain = computed(() => {
    const map = new Map<LifeDomain, LifeGoal[]>();
    for (const goal of this._goals()) {
      const existing = map.get(goal.domain) ?? [];
      map.set(goal.domain, [...existing, goal]);
    }
    return map;
  });

  constructor() {
    if (!this.auth.firebaseEnabled || !this.firestore) {
      return;
    }

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.unsubscribe?.();

      if (!uid) {
        this._goals.set([]);
        return;
      }

      void this.bootstrap.ensureSeeded(uid).then(() => {
        const firestore = this.firestore;
        if (!firestore) {
          return;
        }

        this.unsubscribe = onSnapshot(userGoalsCollection(firestore, uid), (snapshot) => {
          const remote = snapshot.docs.map(
            (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as LifeGoal
          );
          this.applyRemoteGoals(remote);
        });
      });
    });

    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  getById(id: string): LifeGoal | undefined {
    return this._goals().find((g) => g.id === id);
  }

  resetAfterWipe(): void {
    this.pendingGoalIds.clear();
    this._goals.set([]);
  }

  getByDomain(domain: LifeDomain): LifeGoal[] {
    return this._goals().filter((g) => g.domain === domain);
  }

  updateStatus(id: string, status: GoalStatus): void {
    this._goals.update((list) =>
      list.map((g) => (g.id === id ? { ...g, status } : g))
    );
    const goal = this.getById(id);
    if (goal) {
      void this.persistGoal(goal);
    }
  }

  addGoal(partial: Omit<LifeGoal, 'id'>): LifeGoal {
    const goal: LifeGoal = {
      ...partial,
      id: this.createId('goal'),
    };
    this._goals.update((list) => [...list, goal]);
    this.trackPending(goal.id, () => this.persistGoal(goal));
    return goal;
  }

  addFromSuggestion(
    title: string,
    domain: LifeDomain,
    why: string,
    nextAction: string,
    horizon: LifeGoal['horizon'] = 'year'
  ): LifeGoal {
    return this.addGoal({
      title,
      domain: this.normalizeDomain(domain),
      why,
      nextAction,
      horizon,
      status: 'active',
    });
  }

  addManyFromSuggestions(suggestions: GoalSuggestionInput[]): LifeGoal[] {
    const goals = suggestions.map((suggestion) => ({
      id: this.createId('goal'),
      title: `${suggestion.code} ${suggestion.title}`.trim(),
      domain: this.normalizeDomain(suggestion.domain),
      why: suggestion.why,
      nextAction: suggestion.nextAction,
      horizon: suggestion.horizon,
      status: 'active' as const,
    }));

    if (!goals.length) {
      return [];
    }

    this._goals.update((list) => [...list, ...goals]);
    for (const goal of goals) {
      this.pendingGoalIds.add(goal.id);
    }
    void this.persistGoalsBatch(goals).finally(() => {
      for (const goal of goals) {
        this.pendingGoalIds.delete(goal.id);
      }
    });

    return goals;
  }

  getCurrentFocus(): LifeDomain {
    const active = this.activeGoals();
    const domainCounts = new Map<LifeDomain, number>();
    for (const goal of active) {
      domainCounts.set(goal.domain, (domainCounts.get(goal.domain) ?? 0) + 1);
    }
    let maxDomain: LifeDomain = 'Business';
    let maxCount = 0;
    for (const [domain, count] of domainCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxDomain = domain;
      }
    }
    return maxDomain;
  }

  private applyRemoteGoals(remote: LifeGoal[]): void {
    this._goals.update((local) => {
      const remoteIds = new Set(remote.map((goal) => goal.id));
      const pending = local.filter(
        (goal) => this.pendingGoalIds.has(goal.id) && !remoteIds.has(goal.id)
      );
      return this.dedupeById([...remote, ...pending]);
    });
  }

  private trackPending(id: string, persist: () => Promise<void>): void {
    this.pendingGoalIds.add(id);
    void persist().finally(() => this.pendingGoalIds.delete(id));
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private normalizeDomain(domain: LifeDomain): LifeDomain {
    return LIFE_DOMAINS.includes(domain) ? domain : 'Mixed';
  }

  private dedupeById(goals: LifeGoal[]): LifeGoal[] {
    const byId = new Map<string, LifeGoal>();
    for (const goal of goals) {
      byId.set(goal.id, goal);
    }
    return [...byId.values()];
  }

  private async persistGoal(goal: LifeGoal): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    const { id, ...data } = goal;
    await setDoc(userGoalDoc(firestore, uid, id), data);
  }

  private async persistGoalsBatch(goals: LifeGoal[]): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    const batch = writeBatch(firestore);
    for (const goal of goals) {
      const { id, ...data } = goal;
      batch.set(userGoalDoc(firestore, uid, id), data);
    }
    await batch.commit();
  }
}
