import { Component, computed, inject, signal } from '@angular/core';
import { ActionsService } from '../../core/services/actions.service';
import { GoalsService } from '../../core/services/goals.service';
import { AiPlanningService } from '../../core/services/ai-planning.service';
import { DailyPlanService } from '../../core/services/daily-plan.service';
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
  private readonly dailyPlanService = inject(DailyPlanService);

  generating = signal(false);
  topThreeIds = this.actionsService.topThreeIds;

  plan = computed(() => {
    this.dailyPlanService.stored();
    return this.dailyPlanService.buildPlan(
      this.actionsService.actions(),
      this.actionsService.syncReady()
    );
  });

  actionsLoading = computed(() => this.dailyPlanService.isToday() && !this.actionsService.syncReady());

  async generatePlan(): Promise<void> {
    this.generating.set(true);
    try {
      const plan = await this.aiService.generateDailyPlan(
        this.actionsService.actions(),
        this.goalsService.goals()
      );
      this.actionsService.setTopThree(plan.topThree.map((a) => a.id));
      await this.dailyPlanService.save(plan);
    } finally {
      this.generating.set(false);
    }
  }

  onMarkDone(id: string): void {
    this.actionsService.markDone(id);
  }

  onPark(id: string): void {
    this.actionsService.park(id);
  }

  onStart(id: string): void {
    this.actionsService.start(id);
  }

  isTopThree(id: string): boolean {
    return this.topThreeIds().includes(id);
  }
}
