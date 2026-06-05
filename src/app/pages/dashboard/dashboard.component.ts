import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActionsService } from '../../core/services/actions.service';
import { BrainDumpService } from '../../core/services/brain-dump.service';
import { GoalsService } from '../../core/services/goals.service';
import { ActionCardComponent } from '../../shared/components/action-card/action-card.component';
import { GoalCardComponent } from '../../shared/components/goal-card/goal-card.component';
import { DomainChipComponent } from '../../shared/components/domain-chip/domain-chip.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, ActionCardComponent, GoalCardComponent, DomainChipComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly actionsService = inject(ActionsService);
  private readonly brainDumpService = inject(BrainDumpService);
  private readonly goalsService = inject(GoalsService);

  topThree = this.actionsService.topThree;
  openBrainDumps = this.brainDumpService.openItems;
  activeGoals = this.goalsService.activeGoals;
  currentFocus = signal(this.goalsService.getCurrentFocus());

  captureText = signal('');
  processing = signal(false);
  lastProcessedSummary = signal('');

  onMarkDone(id: string): void {
    this.actionsService.markDone(id);
  }

  onPark(id: string): void {
    this.actionsService.park(id);
  }

  onStart(id: string): void {
    this.actionsService.start(id);
  }

  async processCapture(): Promise<void> {
    const text = this.captureText().trim();
    if (!text) return;

    this.processing.set(true);
    try {
      const item = this.brainDumpService.add(text);
      const result = await this.brainDumpService.processAsync(item.id);
      if (result) {
        this.lastProcessedSummary.set(result.summary);
      }
      this.captureText.set('');
    } finally {
      this.processing.set(false);
    }
  }

  get upcomingReview(): string {
    const now = new Date();
    const day = now.getDay();
    const daysUntilSunday = day === 0 ? 7 : 7 - day;
    if (daysUntilSunday <= 2) {
      return 'Weekly review due soon — set aside 20 minutes.';
    }
    return `Next weekly review in ${daysUntilSunday} days.`;
  }
}
