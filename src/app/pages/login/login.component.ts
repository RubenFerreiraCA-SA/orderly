import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-page">
      <div class="login-card">
        <p class="eyebrow">Orderly</p>
        <h1>Your calm command centre</h1>
        <p class="subtitle">
          Sign in to sync actions, goals, and brain dumps across devices.
        </p>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button
          type="button"
          class="google-btn"
          [disabled]="loading()"
          (click)="signIn()"
        >
          {{ loading() ? 'Signing in…' : 'Continue with Google' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .login-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background:
        radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 45%),
        var(--surface-1, #f8fafc);
    }

    .login-card {
      width: min(100%, 26rem);
      background: var(--surface-0, #fff);
      border: 1px solid var(--border, #e2e8f0);
      border-radius: var(--radius-lg, 1rem);
      padding: 2rem;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    }

    .eyebrow {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent, #2563eb);
    }

    h1 {
      margin: 0.5rem 0 0;
      font-size: 1.75rem;
      color: var(--text-primary, #0f172a);
    }

    .subtitle {
      margin: 0.75rem 0 1.5rem;
      color: var(--text-muted, #64748b);
      line-height: 1.6;
    }

    .google-btn {
      width: 100%;
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 999px;
      background: #fff;
      color: var(--text-primary, #0f172a);
      font: inherit;
      font-weight: 600;
      padding: 0.85rem 1rem;
      cursor: pointer;
    }

    .google-btn:hover:not(:disabled) {
      border-color: var(--accent, #2563eb);
    }

    .google-btn:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    .error {
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 0.875rem;
    }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Try again.';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
