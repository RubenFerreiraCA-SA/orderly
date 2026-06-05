import { Component, computed, inject, output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/brain-dump': 'Brain Dump',
  '/daily-plan': 'Daily Plan',
  '/actions': 'Actions',
  '/goals': 'Goals',
  '/weekly-review': 'Weekly Review',
  '/settings': 'Settings',
};

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  menuToggle = output<void>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: '/dashboard' }
  );

  readonly showAccount = computed(() => this.auth.firebaseEnabled && this.auth.isAuthenticated());
  readonly displayName = computed(() => this.auth.displayName());
  readonly photoUrl = computed(() => this.auth.photoUrl());

  pageTitle = computed(() => {
    const url = this.routeUrl() ?? '/dashboard';
    return PAGE_TITLES[url] ?? 'Orderly';
  });

  today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
