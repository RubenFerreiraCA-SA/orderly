import { Injectable, inject } from '@angular/core';
import { Firestore, getDoc, serverTimestamp, setDoc, writeBatch } from '@angular/fire/firestore';
import {
  INITIAL_TOP_THREE_IDS,
  MOCK_ACTIONS,
  MOCK_BRAIN_DUMPS,
  MOCK_GOALS,
} from '../data/mock-data';
import {
  userActionDoc,
  userBootstrapDoc,
  userBrainDumpDoc,
  userGoalDoc,
  userTopThreeDoc,
} from '../firebase/firestore-paths';

@Injectable({ providedIn: 'root' })
export class FirestoreBootstrapService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly seededUsers = new Set<string>();
  private readonly seedingUsers = new Set<string>();

  async ensureSeeded(uid: string): Promise<void> {
    if (!this.firestore) {
      return;
    }

    if (this.seededUsers.has(uid) || this.seedingUsers.has(uid)) {
      return;
    }

    const bootstrapRef = userBootstrapDoc(this.firestore, uid);
    const bootstrapSnap = await getDoc(bootstrapRef);
    if (bootstrapSnap.exists()) {
      this.seededUsers.add(uid);
      return;
    }

    this.seedingUsers.add(uid);
    try {
      const batch = writeBatch(this.firestore);

      for (const action of MOCK_ACTIONS) {
        const { id, ...data } = action;
        batch.set(userActionDoc(this.firestore, uid, id), data);
      }

      for (const goal of MOCK_GOALS) {
        const { id, ...data } = goal;
        batch.set(userGoalDoc(this.firestore, uid, id), data);
      }

      for (const item of MOCK_BRAIN_DUMPS) {
        const { id, ...data } = item;
        batch.set(userBrainDumpDoc(this.firestore, uid, id), data);
      }

      batch.set(userTopThreeDoc(this.firestore, uid), { ids: [...INITIAL_TOP_THREE_IDS] });
      batch.set(bootstrapRef, { seededAt: serverTimestamp() });

      await batch.commit();
      this.seededUsers.add(uid);
    } finally {
      this.seedingUsers.delete(uid);
    }
  }
}
