import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Firestore, onSnapshot, setDoc } from '@angular/fire/firestore';
import { BrainDumpItem, BrainDumpStatus, ProcessedBrainDump } from '../models/brain-dump.model';
import { MOCK_BRAIN_DUMPS } from '../data/mock-data';
import { AiPlanningService } from './ai-planning.service';
import { AuthService } from './auth.service';
import { FirestoreBootstrapService } from './firestore-bootstrap.service';
import { userBrainDumpDoc, userBrainDumpsCollection } from '../firebase/firestore-paths';

@Injectable({ providedIn: 'root' })
export class BrainDumpService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(FirestoreBootstrapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ai = inject(AiPlanningService);

  private readonly _items = signal<BrainDumpItem[]>(
    this.auth.firebaseEnabled ? [] : [...MOCK_BRAIN_DUMPS]
  );
  private unsubscribe?: () => void;

  readonly items = this._items.asReadonly();

  readonly unprocessed = computed(() =>
    this._items().filter((i) => i.status === 'unprocessed')
  );

  readonly openItems = computed(() =>
    this._items().filter((i) => i.status === 'unprocessed' || i.status === 'processed')
  );

  constructor() {
    if (!this.auth.firebaseEnabled || !this.firestore) {
      return;
    }

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.unsubscribe?.();

      if (!uid) {
        this._items.set([]);
        return;
      }

      void this.bootstrap.ensureSeeded(uid).then(() => {
        const firestore = this.firestore;
        if (!firestore) {
          return;
        }

        this.unsubscribe = onSnapshot(userBrainDumpsCollection(firestore, uid), (snapshot) => {
          const items = snapshot.docs.map(
            (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as BrainDumpItem
          );
          this._items.set(items);
        });
      });
    });

    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  getById(id: string): BrainDumpItem | undefined {
    return this._items().find((i) => i.id === id);
  }

  resetAfterWipe(): void {
    this._items.set([]);
  }

  add(rawText: string): BrainDumpItem {
    const item: BrainDumpItem = {
      id: `bd-${Date.now()}`,
      rawText: rawText.trim(),
      createdAt: new Date().toISOString(),
      suggestedDomain: 'Mixed',
      suggestedPriority: 'Medium',
      suggestedActions: [],
      status: 'unprocessed',
    };
    this._items.update((list) => [item, ...list]);
    void this.persistItem(item);
    return item;
  }

  process(id: string): Promise<ProcessedBrainDump | null> {
    return this.processAsync(id);
  }

  async processAsync(id: string): Promise<ProcessedBrainDump | null> {
    const item = this.getById(id);
    if (!item) return null;

    const result = await this.ai.processBrainDump(item.rawText);
    this.lastAiSource = this.ai.lastSource;
    const updated: BrainDumpItem = {
      ...item,
      suggestedDomain: result.suggestedDomain,
      suggestedPriority: result.suggestedPriority,
      suggestedActions: result.suggestedActions,
      status: 'processed',
      documentType: result.documentType,
      processingSummary: result.summary,
      themes: result.themes,
      weeklyFocus: result.weeklyFocus,
      quarterFocus: result.quarterFocus,
      parkedItems: result.parkedItems,
      mustWinItems: result.mustWinItems,
      goalSuggestions: result.goalSuggestions,
    };
    this._items.update((list) => list.map((i) => (i.id === id ? updated : i)));
    void this.persistItem(updated);
    return result;
  }

  lastAiSource: 'gemini' | 'local' = 'local';

  processAndReturn(id: string): Promise<BrainDumpItem | undefined> {
    return this.processAsync(id).then(() => this.getById(id));
  }

  park(id: string): void {
    this.updateStatus(id, 'parked');
  }

  markProcessed(id: string): void {
    this.updateStatus(id, 'processed');
  }

  markConverted(id: string): void {
    this.updateStatus(id, 'converted');
  }

  private updateStatus(id: string, status: BrainDumpStatus): void {
    this._items.update((list) =>
      list.map((i) => (i.id === id ? { ...i, status } : i))
    );
    const item = this.getById(id);
    if (item) {
      void this.persistItem(item);
    }
  }

  private async persistItem(item: BrainDumpItem): Promise<void> {
    const uid = this.auth.user()?.uid;
    const firestore = this.firestore;
    if (!uid || !this.auth.firebaseEnabled || !firestore) return;

    const { id, ...data } = item;
    await setDoc(userBrainDumpDoc(firestore, uid, id), data);
  }
}
