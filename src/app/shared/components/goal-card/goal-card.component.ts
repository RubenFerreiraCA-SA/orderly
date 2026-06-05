import { Component, input } from '@angular/core';
import { LifeGoal } from '../../../core/models/goal.model';
import { DomainChipComponent } from '../domain-chip/domain-chip.component';
import { StatusPillComponent } from '../status-pill/status-pill.component';

@Component({
  selector: 'app-goal-card',
  standalone: true,
  imports: [DomainChipComponent, StatusPillComponent],
  templateUrl: './goal-card.component.html',
  styleUrl: './goal-card.component.scss',
})
export class GoalCardComponent {
  goal = input.required<LifeGoal>();
}
