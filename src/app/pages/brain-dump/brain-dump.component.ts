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
    this.actionsService.addFromSuggestion(actionTitle, item.suggestedDomain);
    if (item.suggestedActions.every((a) => a === actionTitle || item.status === 'converted')) {
      this.brainDumpService.markConverted(item.id);
    }
  }

  convertAllActions(item: BrainDumpItem): void {
    for (const action of item.suggestedActions) {
      this.actionsService.addFromSuggestion(action, item.suggestedDomain);
    }
    this.brainDumpService.markConverted(item.id);
  }

  convertWeeklyFocus(item: BrainDumpItem): void {
    for (const action of item.weeklyFocus ?? []) {
      this.actionsService.addFromSuggestion(action, item.suggestedDomain);
    }
  }

  importGoal(goal: ExtractedGoalSuggestion): void {
    this.goalsService.addFromSuggestion(
      `${goal.code} ${goal.title}`,
      goal.domain,
      goal.why,
      goal.nextAction,
      goal.horizon
    );
  }

  importAllGoals(item: BrainDumpItem): void {
    for (const goal of item.goalSuggestions ?? []) {
      this.importGoal(goal);
    }
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
}
