import { Component, input } from '@angular/core';
import { LifeDomain, DOMAIN_COLORS } from '../../../core/models/life-domain.model';

@Component({
  selector: 'app-domain-chip',
  standalone: true,
  template: `<span class="chip" [style.--chip-color]="color()">{{ domain() }}</span>`,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--chip-color) 18%, transparent);
      color: var(--chip-color);
      border: 1px solid color-mix(in srgb, var(--chip-color) 30%, transparent);
    }
  `,
})
export class DomainChipComponent {
  domain = input.required<LifeDomain>();

  color = () => DOMAIN_COLORS[this.domain()];
}
