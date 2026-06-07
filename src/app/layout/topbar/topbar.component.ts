import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { UserDataService } from '../../core/services/user-data.service';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/brain-dump': 'Brain Dump',
  '/daily-plan': 'Daily Plan',
  '/actions': 'Actions',
  '/goals': 'Goals',
  '/weekly-review': 'Weekly Review',
  '/settings': 'Settings',
};

const WIPE_CONFIRM_PHRASE = 'DELETE';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  menuToggle = output<void>();

  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private readonly router = inject(Router);
  private readonly accountMenuRef = viewChild<ElementRef<HTMLElement>>('accountMenu');

  private readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: '/dashboard' }
  );

  readonly showAccount = computed(() => this.auth.firebaseEnabled && this.auth.isAuthenticated());
  readonly displayName = computed(() => this.auth.displayName());
  readonly email = computed(() => this.auth.user()?.email ?? null);
  readonly photoUrl = computed(() => this.auth.photoUrl());
  readonly initials = computed(() => {
    const name = this.displayName() ?? this.email() ?? '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  readonly menuOpen = signal(false);
  readonly wipeDialogOpen = signal(false);
  readonly wipeConfirmText = signal('');
  readonly accountBusy = signal(false);
  readonly accountError = signal<string | null>(null);

  readonly wipeReady = computed(
    () => this.wipeConfirmText().trim().toUpperCase() === WIPE_CONFIRM_PHRASE
  );

  pageTitle = computed(() => {
    const url = this.routeUrl() ?? '/dashboard';
    return PAGE_TITLES[url] ?? 'Orderly';
  });

  today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const menuEl = this.accountMenuRef()?.nativeElement;
    if (menuEl && !menuEl.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.wipeDialogOpen()) {
      this.closeWipeDialog();
      return;
    }
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    this.accountError.set(null);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  openWipeDialog(): void {
    this.closeMenu();
    this.wipeConfirmText.set('');
    this.accountError.set(null);
    this.wipeDialogOpen.set(true);
  }

  closeWipeDialog(): void {
    if (this.accountBusy()) {
      return;
    }
    this.wipeDialogOpen.set(false);
    this.wipeConfirmText.set('');
    this.accountError.set(null);
  }

  async signOut(): Promise<void> {
    this.closeMenu();
    await this.runAccountAction(() => this.auth.signOut());
  }

  async confirmWipe(): Promise<void> {
    if (!this.wipeReady() || this.accountBusy()) {
      return;
    }

    this.accountBusy.set(true);
    this.accountError.set(null);
    try {
      await this.userData.wipeAllData();
      this.wipeDialogOpen.set(false);
      this.wipeConfirmText.set('');
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete your data.';
      this.accountError.set(message);
    } finally {
      this.accountBusy.set(false);
    }
  }

  private async runAccountAction(action: () => Promise<void>): Promise<void> {
    this.accountBusy.set(true);
    this.accountError.set(null);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      this.accountError.set(message);
    } finally {
      this.accountBusy.set(false);
    }
  }
}
