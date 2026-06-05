import { Component, computed, inject, signal } from '@angular/core';
import { ActionsService } from '../../core/services/actions.service';
import { LIFE_DOMAINS, LifeDomain } from '../../core/models/life-domain.model';
import { ActionStatus } from '../../core/models/action.model';
import { ActionCardComponent } from '../../shared/components/action-card/action-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [ActionCardComponent, EmptyStateComponent],
  templateUrl: './actions.component.html',
  styleUrl: './actions.component.scss',
})
export class ActionsComponent {
  private readonly actionsService = inject(ActionsService);

  actions = this.actionsService.actions;
  topThreeIds = this.actionsService.topThreeIds;
  domains = LIFE_DOMAINS;

  selectedDomain = signal<LifeDomain | 'all'>('all');
  selectedStatus = signal<ActionStatus | 'all'>('all');
  groupByDomain = signal(true);

  filteredActions = computed(() => {
    let list = this.actions();
    const domain = this.selectedDomain();
    const status = this.selectedStatus();

    if (domain !== 'all') {
      list = list.filter((a) => a.domain === domain);
    }
    if (status !== 'all') {
      list = list.filter((a) => a.status === status);
    }
    return list;
  });

  groupedActions = computed(() => {
    const map = new Map<LifeDomain, ReturnType<typeof this.actionsService.actions>>();
    for (const domain of this.domains) {
      const domainActions = this.filteredActions().filter((a) => a.domain === domain);
      if (domainActions.length) {
        map.set(domain, domainActions);
      }
    }
    return map;
  });

  onMarkDone(id: string): void {
    this.actionsService.markDone(id);
  }

  onPark(id: string): void {
    this.actionsService.park(id);
  }

  onPromote(id: string): void {
    this.actionsService.promoteToTopThree(id);
  }

  onStart(id: string): void {
    this.actionsService.start(id);
  }

  isTopThree(id: string): boolean {
    return this.topThreeIds().includes(id);
  }

  setDomain(value: string): void {
    this.selectedDomain.set(value as LifeDomain | 'all');
  }

  setStatus(value: string): void {
    this.selectedStatus.set(value as ActionStatus | 'all');
  }
}
