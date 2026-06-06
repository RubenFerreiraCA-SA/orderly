import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrainDumpService } from '../../core/services/brain-dump.service';
import { ActionsService } from '../../core/services/actions.service';
import { GoalsService } from '../../core/services/goals.service';
import { BrainDumpItem, ExtractedGoalSuggestion } from '../../core/models/brain-dump.model';
import { DomainChipComponent } from '../../shared/components/domain-chip/domain-chip.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-brain-dump',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DomainChipComponent, StatusPillComponent, EmptyStateComponent],
  templateUrl: './brain-dump.component.html',
  styleUrl: './brain-dump.component.scss',
})
export class BrainDumpComponent {
  private readonly brainDumpService = inject(BrainDumpService);
  private readonly actionsService = inject(ActionsService);
  private readonly goalsService = inject(GoalsService);

  items = this.brainDumpService.items;
  newText = signal('');
  processingId = signal<string | null>(null);
  processingError = signal<string | null>(null);
  aiSource = signal<'gemini' | 'local' | null>(null);
  expandedId = signal<string | null>(null);
  expandedTextIds = signal<Set<string>>(new Set());
  importFeedback = signal<string | null>(null);
  importingKey = signal<string | null>(null);
  importedGoalKeys = signal<Set<string>>(new Set());
  importedActionKeys = signal<Set<string>>(new Set());

  readonly charCount = computed(() => this.newText().length);
  readonly isLongDraft = computed(() => this.charCount() > 1500);

  addItem(): void {
    const text = this.newText().trim();
    if (!text) return;
    const item = this.brainDumpService.add(text);
    this.newText.set('');
    if (text.length > 1500) {
      this.expandedId.set(item.id);
    }
  }

  async processItem(id: string): Promise<void> {
    this.processingId.set(id);
    this.processingError.set(null);
    this.aiSource.set(null);

    try {
      await this.brainDumpService.processAsync(id);
      this.expandedId.set(id);
      this.aiSource.set(this.brainDumpService.lastAiSource);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed. Try again.';
      this.processingError.set(message);
    } finally {
      this.processingId.set(null);
    }
  }

  convertAction(item: BrainDumpItem, actionTitle: string): void {
    this.runImport(`action:${item.id}:${actionTitle}`, () => {
      this.actionsService.addFromSuggestion(actionTitle, item.suggestedDomain);
      this.markActionImported(item.id, actionTitle);
      if (this.allActionsImported(item)) {
        this.brainDumpService.markConverted(item.id);
      }
      this.importFeedback.set(`Added action: ${actionTitle.slice(0, 60)}${actionTitle.length > 60 ? '…' : ''}`);
    });
  }

  convertAllActions(item: BrainDumpItem): void {
    const pending = item.suggestedActions.filter(
      (action) => !this.isActionImported(item.id, action)
    );
    this.runImport(`actions-all:${item.id}`, () => {
      this.actionsService.addManyFromSuggestions(
        pending.map((title) => ({ title, domain: item.suggestedDomain }))
      );
      for (const action of pending) {
        this.markActionImported(item.id, action);
      }
      this.brainDumpService.markConverted(item.id);
      this.importFeedback.set(`Added ${pending.length} actions`);
    });
  }

  convertWeeklyFocus(item: BrainDumpItem): void {
    const focusItems = item.weeklyFocus ?? [];
    this.runImport(`weekly:${item.id}`, () => {
      this.actionsService.addManyFromSuggestions(
        focusItems.map((title) => ({ title, domain: item.suggestedDomain }))
      );
      this.importFeedback.set(`Added ${focusItems.length} weekly focus actions`);
    });
  }

  importGoal(item: BrainDumpItem, goal: ExtractedGoalSuggestion): void {
    const key = this.goalKey(item.id, goal);
    if (this.importedGoalKeys().has(key)) {
      return;
    }

    this.runImport(key, () => {
      this.goalsService.addFromSuggestion(
        `${goal.code} ${goal.title}`.trim(),
        goal.domain,
        goal.why,
        goal.nextAction,
        goal.horizon
      );
      this.markGoalImported(key);
      this.importFeedback.set(`Imported goal: ${goal.title}`);
    });
  }

  importAllGoals(item: BrainDumpItem): void {
    const pending = (item.goalSuggestions ?? []).filter(
      (goal) => !this.importedGoalKeys().has(this.goalKey(item.id, goal))
    );

    this.runImport(`goals-all:${item.id}`, () => {
      const imported = this.goalsService.addManyFromSuggestions(pending);
      for (const goal of pending) {
        this.markGoalImported(this.goalKey(item.id, goal));
      }
      this.importFeedback.set(`Imported ${imported.length} goals — check the Goals page`);
    });
  }

  isGoalImported(itemId: string, goal: ExtractedGoalSuggestion): boolean {
    return this.importedGoalKeys().has(this.goalKey(itemId, goal));
  }

  isActionImported(itemId: string, action: string): boolean {
    return this.importedActionKeys().has(`${itemId}:${action}`);
  }

  isImporting(key: string): boolean {
    return this.importingKey() === key;
  }

  parkItem(id: string): void {
    this.brainDumpService.park(id);
  }

  markProcessed(id: string): void {
    this.brainDumpService.markProcessed(id);
  }

  toggleExpand(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  toggleTextExpand(id: string): void {
    this.expandedTextIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  isTextExpanded(id: string): boolean {
    return this.expandedTextIds().has(id);
  }

  previewText(text: string, expanded: boolean): string {
    if (expanded || text.length <= 280) {
      return text;
    }
    return `${text.slice(0, 280).trim()}…`;
  }

  documentTypeLabel(item: BrainDumpItem): string {
    return item.documentType === 'annual_plan' ? 'Annual plan' : 'Quick thought';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  goalKey(itemId: string, goal: ExtractedGoalSuggestion): string {
    return `${itemId}:${goal.code}:${goal.title}`;
  }

  private markGoalImported(key: string): void {
    this.importedGoalKeys.update((current) => new Set(current).add(key));
  }

  private markActionImported(itemId: string, action: string): void {
    this.importedActionKeys.update((current) => new Set(current).add(`${itemId}:${action}`));
  }

  private allActionsImported(item: BrainDumpItem): boolean {
    return item.suggestedActions.every((action) => this.isActionImported(item.id, action));
  }

  private runImport(key: string, action: () => void): void {
    this.importingKey.set(key);
    this.importFeedback.set(null);

    try {
      action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed. Try again.';
      this.importFeedback.set(message);
    } finally {
      this.importingKey.set(null);
    }
  }
}
