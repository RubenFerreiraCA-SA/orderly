import { Component, computed, inject } from '@angular/core';
import { GoalsService } from '../../core/services/goals.service';
import { LIFE_DOMAINS, LifeDomain } from '../../core/models/life-domain.model';
import { GoalCardComponent } from '../../shared/components/goal-card/goal-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [GoalCardComponent, EmptyStateComponent],
  templateUrl: './goals.component.html',
  styleUrl: './goals.component.scss',
})
export class GoalsComponent {
  private readonly goalsService = inject(GoalsService);

  goals = this.goalsService.goals;
  domains = LIFE_DOMAINS;

  groupedGoals = computed(() => {
    const map = new Map<LifeDomain, ReturnType<typeof this.goalsService.goals>>();
    for (const domain of this.domains) {
      const domainGoals = this.goals().filter((g) => g.domain === domain);
      if (domainGoals.length) {
        map.set(domain, domainGoals);
      }
    }
    return map;
  });
}
