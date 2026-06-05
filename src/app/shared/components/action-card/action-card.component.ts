import { Component, input, output } from '@angular/core';
import { LifeAction } from '../../../core/models/action.model';
import { DomainChipComponent } from '../domain-chip/domain-chip.component';
import { StatusPillComponent } from '../status-pill/status-pill.component';

@Component({
  selector: 'app-action-card',
  standalone: true,
  imports: [DomainChipComponent, StatusPillComponent],
  templateUrl: './action-card.component.html',
  styleUrl: './action-card.component.scss',
})
export class ActionCardComponent {
  action = input.required<LifeAction>();
  showReason = input(true);
  showActions = input(true);
  compact = input(false);
  isTopThree = input(false);

  markDone = output<string>();
  park = output<string>();
  promote = output<string>();
  start = output<string>();
}
