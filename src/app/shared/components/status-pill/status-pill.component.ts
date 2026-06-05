import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  template: `<span class="pill" [class]="statusClass()">{{ displayLabel() }}</span>`,
  styles: `
    .pill {
      display: inline-flex;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 500;
      text-transform: capitalize;
      letter-spacing: 0.02em;
    }
    .not_started { background: var(--surface-3); color: var(--text-muted); }
    .in_progress { background: rgba(107, 155, 209, 0.15); color: #6b9bd1; }
    .done { background: rgba(126, 200, 139, 0.15); color: #7ec88b; }
    .parked { background: rgba(160, 160, 160, 0.12); color: #a0a0a0; }
    .active { background: rgba(92, 184, 165, 0.15); color: #5cb8a5; }
    .completed { background: rgba(126, 200, 139, 0.15); color: #7ec88b; }
    .processed { background: rgba(107, 155, 209, 0.12); color: #6b9bd1; }
    .unprocessed { background: rgba(212, 168, 83, 0.15); color: #d4a853; }
    .converted { background: rgba(92, 184, 165, 0.12); color: #5cb8a5; }
  `,
})
export class StatusPillComponent {
  status = input.required<string>();
  label = input<string>('');

  statusClass = computed(() => this.status().replace(/\s+/g, '_'));

  displayLabel = computed(() => {
    const custom = this.label();
    return custom || this.status().replace(/_/g, ' ');
  });
}
