import { Component, inject, signal } from '@angular/core';
import { ActionsService } from '../../core/services/actions.service';
import { GoalsService } from '../../core/services/goals.service';
import { AiPlanningService } from '../../core/services/ai-planning.service';
import { DailyPlan } from '../../core/models/planning.model';
import { ActionCardComponent } from '../../shared/components/action-card/action-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-daily-plan',
  standalone: true,
  imports: [ActionCardComponent, EmptyStateComponent],
  templateUrl: './daily-plan.component.html',
  styleUrl: './daily-plan.component.scss',
})
export class DailyPlanComponent {
  private readonly actionsService = inject(ActionsService);
  private readonly goalsService = inject(GoalsService);
  private readonly aiService = inject(AiPlanningService);

  plan = signal<DailyPlan | null>(null);
  generating = signal(false);
  topThreeIds = this.actionsService.topThreeIds;

  async generatePlan(): Promise<void> {
    this.generating.set(true);
    try {
      const plan = await this.aiService.generateDailyPlan(
        this.actionsService.actions(),
        this.goalsService.goals()
      );
      this.actionsService.setTopThree(plan.topThree.map((a) => a.id));
      this.plan.set(plan);
    } finally {
      this.generating.set(false);
    }
  }

  onMarkDone(id: string): void {
    this.actionsService.markDone(id);
    this.refreshPlanFromService();
  }

  onPark(id: string): void {
    this.actionsService.park(id);
    this.refreshPlanFromService();
  }

  onStart(id: string): void {
    this.actionsService.start(id);
  }

  private refreshPlanFromService(): void {
    const current = this.plan();
    if (!current) return;
    const topThree = this.actionsService.topThree();
    this.plan.set({ ...current, topThree });
  }

  isTopThree(id: string): boolean {
    return this.topThreeIds().includes(id);
  }
}
