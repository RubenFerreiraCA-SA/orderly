import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty">
      <div class="empty-icon">{{ icon() }}</div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
    </div>
  `,
  styles: `
    .empty {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--text-muted);
    }
    .empty-icon {
      font-size: 2rem;
      margin-bottom: 0.75rem;
      opacity: 0.5;
    }
    h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-secondary);
    }
    p {
      margin: 0;
      font-size: 0.875rem;
      max-width: 320px;
      margin-inline: auto;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  icon = input('○');
  title = input('Nothing here yet');
  message = input('Items will appear here when you add them.');
}
