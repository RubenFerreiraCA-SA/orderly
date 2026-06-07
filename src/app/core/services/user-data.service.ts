import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  deleteDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { CollectionReference, DocumentReference } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { ActionsService } from './actions.service';
import { GoalsService } from './goals.service';
import { BrainDumpService } from './brain-dump.service';
import { DailyPlanService } from './daily-plan.service';
import {
  userActionsCollection,
  userBootstrapDoc,
  userBrainDumpsCollection,
  userDailyPlanDoc,
  userGoalsCollection,
  userTopThreeDoc,
} from '../firebase/firestore-paths';

const LOCAL_STORAGE_PREFIX = 'orderly.dailyPlan';

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly actionsService = inject(ActionsService);
  private readonly goalsService = inject(GoalsService);
  private readonly brainDumpService = inject(BrainDumpService);
  private readonly dailyPlanService = inject(DailyPlanService);

  readonly wiping = signal(false);

  async wipeAllData(): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;

    if (!uid) {
      throw new Error('You must be signed in to delete your data.');
    }

    if (!this.auth.firebaseEnabled || !firestore) {
      throw new Error('Cloud sync is not configured.');
    }

    this.wiping.set(true);
    try {
      await Promise.all([
        this.deleteCollection(userActionsCollection(firestore, uid)),
        this.deleteCollection(userGoalsCollection(firestore, uid)),
        this.deleteCollection(userBrainDumpsCollection(firestore, uid)),
      ]);

      await Promise.all([
        this.deleteDocIfExists(userTopThreeDoc(firestore, uid)),
        this.deleteDocIfExists(userDailyPlanDoc(firestore, uid)),
      ]);

      await setDoc(userBootstrapDoc(firestore, uid), {
        wipedAt: serverTimestamp(),
      });

      this.clearLocalStorage(uid);
      this.resetLocalState();
    } finally {
      this.wiping.set(false);
    }
  }

  private async deleteCollection(collectionRef: CollectionReference): Promise<void> {
    const firestore = this.firestore;
    if (!firestore) {
      return;
    }

    const snapshot = await getDocs(collectionRef);
    if (snapshot.empty) {
      return;
    }

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(firestore);
      for (const docSnap of docs.slice(i, i + 500)) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }
  }

  private async deleteDocIfExists(docRef: DocumentReference): Promise<void> {
    try {
      await deleteDoc(docRef);
    } catch {
      // Doc may not exist — that's fine.
    }
  }

  private clearLocalStorage(uid: string): void {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}.${uid}`);
    localStorage.removeItem(LOCAL_STORAGE_PREFIX);
  }

  private resetLocalState(): void {
    this.actionsService.resetAfterWipe();
    this.goalsService.resetAfterWipe();
    this.brainDumpService.resetAfterWipe();
    this.dailyPlanService.resetAfterWipe();
  }
}
