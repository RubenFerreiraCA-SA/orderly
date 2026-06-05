import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  host: {
    '[class.open]': 'open()',
  },
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  open = input(false);
  navigate = output<void>();

  navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '◈' },
    { label: 'Brain Dump', route: '/brain-dump', icon: '◎' },
    { label: 'Daily Plan', route: '/daily-plan', icon: '◷' },
    { label: 'Actions', route: '/actions', icon: '▷' },
    { label: 'Goals', route: '/goals', icon: '◇' },
    { label: 'Weekly Review', route: '/weekly-review', icon: '◐' },
    { label: 'Settings', route: '/settings', icon: '⚙' },
  ];

  onNavClick(): void {
    this.navigate.emit();
  }
}
