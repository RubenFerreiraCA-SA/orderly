import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Firestore, getDoc, onSnapshot, setDoc } from '@angular/fire/firestore';
import { DailyPlan, PersistedDailyPlan } from '../models/planning.model';
import { LifeAction } from '../models/action.model';
import { AuthService } from './auth.service';
import { userDailyPlanDoc } from '../firebase/firestore-paths';

const LOCAL_STORAGE_PREFIX = 'orderly.dailyPlan';

@Injectable({ providedIn: 'root' })
export class DailyPlanService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingSave = signal(false);

  private readonly _stored = signal<PersistedDailyPlan | null>(null);
  private unsubscribe?: () => void;

  readonly stored = this._stored.asReadonly();

  readonly isToday = computed(() => {
    const stored = this._stored();
    return !!stored && stored.planDate === todayDateString();
  });

  constructor() {
    this._stored.set(this.loadFromLocalStorage());

    if (!this.auth.firebaseEnabled || !this.firestore) {
      return;
    }

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.unsubscribe?.();

      if (!uid) {
        // Auth still initialising — keep whatever we loaded from localStorage.
        return;
      }

      const firestore = this.firestore;
      if (!firestore) {
        return;
      }

      untracked(() => {
        if (!this._stored()) {
          this._stored.set(this.loadFromLocalStorage(uid));
        }
      });

      void this.hydrateFromFirestore(firestore, uid);

      this.unsubscribe = onSnapshot(userDailyPlanDoc(firestore, uid), (snapshot) => {
        if (this.pendingSave()) {
          return;
        }

        if (!snapshot.exists()) {
          if (!this._stored()) {
            this._stored.set(this.loadFromLocalStorage(uid));
          }
          return;
        }

        const data = snapshot.data() as PersistedDailyPlan;
        if (data?.planDate === todayDateString()) {
          this._stored.set(data);
          this.saveToLocalStorage(data, uid);
        }
      });
    });

    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  buildPlan(actions: LifeAction[], actionsLoaded: boolean): DailyPlan | null {
    const stored = this._stored();
    if (!stored || stored.planDate !== todayDateString()) {
      return null;
    }

    const byId = new Map(actions.map((action) => [action.id, action]));
    const topThree = stored.topThreeIds
      .map((id) => byId.get(id))
      .filter((action): action is LifeAction => !!action);
    const optionalExtras = stored.optionalExtraIds
      .map((id) => byId.get(id))
      .filter((action): action is LifeAction => !!action);

    // Actions still loading from Firestore — show saved plan metadata immediately.
    if (!topThree.length && !actionsLoaded) {
      return {
        topThree: [],
        optionalExtras: [],
        parkedItems: [],
        summary: stored.summary,
        energyCheck: stored.energyCheck,
        availableTime: stored.availableTime,
      };
    }

    if (!topThree.length) {
      return null;
    }

    return {
      topThree,
      optionalExtras,
      parkedItems: actions.filter((action) => action.status === 'parked').slice(0, 4),
      summary: stored.summary,
      energyCheck: stored.energyCheck,
      availableTime: stored.availableTime,
    };
  }

  async save(plan: DailyPlan): Promise<void> {
    const uid = this.auth.user()?.uid ?? undefined;
    const persisted: PersistedDailyPlan = {
      planDate: todayDateString(),
      topThreeIds: plan.topThree.map((action) => action.id),
      optionalExtraIds: plan.optionalExtras.map((action) => action.id),
      summary: plan.summary,
      energyCheck: plan.energyCheck,
      availableTime: plan.availableTime,
    };

    this._stored.set(persisted);
    this.saveToLocalStorage(persisted, uid);
    await this.persist(persisted);
  }

  clearToday(): void {
    const uid = this.auth.user()?.uid;
    if (this._stored()?.planDate === todayDateString()) {
      this._stored.set(null);
      localStorage.removeItem(storageKey(uid));
    }
  }

  private async hydrateFromFirestore(firestore: Firestore, uid: string): Promise<void> {
    try {
      const snapshot = await getDoc(userDailyPlanDoc(firestore, uid));
      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.data() as PersistedDailyPlan;
      if (data?.planDate === todayDateString()) {
        this._stored.set(data);
        this.saveToLocalStorage(data, uid);
      }
    } catch (error) {
      console.warn('Failed to load daily plan from Firestore', error);
    }
  }

  private async persist(plan: PersistedDailyPlan): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) {
      return;
    }

    this.pendingSave.set(true);
    try {
      await setDoc(userDailyPlanDoc(firestore, uid), plan);
      this.saveToLocalStorage(plan, uid);
    } finally {
      this.pendingSave.set(false);
    }
  }

  private loadFromLocalStorage(uid?: string): PersistedDailyPlan | null {
    try {
      const keys = uid ? [storageKey(uid), storageKey()] : [storageKey()];

      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw) as PersistedDailyPlan;
        if (parsed.planDate === todayDateString()) {
          return parsed;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private saveToLocalStorage(plan: PersistedDailyPlan, uid?: string): void {
    localStorage.setItem(storageKey(uid), JSON.stringify(plan));
    if (uid) {
      localStorage.removeItem(storageKey());
    }
  }
}

function storageKey(uid?: string): string {
  return uid ? `${LOCAL_STORAGE_PREFIX}.${uid}` : LOCAL_STORAGE_PREFIX;
}

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}
