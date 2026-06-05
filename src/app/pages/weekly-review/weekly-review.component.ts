import { Component, inject, OnInit, signal } from '@angular/core';
import { ActionsService } from '../../core/services/actions.service';
import { GoalsService } from '../../core/services/goals.service';
import { AiPlanningService } from '../../core/services/ai-planning.service';
import { WeeklyReview } from '../../core/models/planning.model';
import { DomainChipComponent } from '../../shared/components/domain-chip/domain-chip.component';

@Component({
  selector: 'app-weekly-review',
  standalone: true,
  imports: [DomainChipComponent],
  templateUrl: './weekly-review.component.html',
  styleUrl: './weekly-review.component.scss',
})
export class WeeklyReviewComponent implements OnInit {
  private readonly actionsService = inject(ActionsService);
  private readonly goalsService = inject(GoalsService);
  private readonly aiService = inject(AiPlanningService);

  review = signal<WeeklyReview | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    void this.loadReview();
  }

  async loadReview(): Promise<void> {
    this.loading.set(true);
    try {
      const review = await this.aiService.summariseWeek(
        this.actionsService.actions(),
        this.goalsService.goals()
      );
      this.review.set(review);
    } finally {
      this.loading.set(false);
    }
  }

  refreshReview(): void {
    void this.loadReview();
  }
}
