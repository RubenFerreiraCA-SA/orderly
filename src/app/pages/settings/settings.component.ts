import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AiBackendService } from '../../core/services/ai-backend.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div class="settings-page">
      <header class="page-header">
        <h2>Settings</h2>
        <p class="subtitle">Firebase sync, AI, and integrations.</p>
      </header>

      <section class="card">
        <h3>AI</h3>
        <p class="status ok">Model: <strong>Gemini 2.0 Flash Lite</strong> via Cloud Functions</p>
        <p class="hint">
          Lowest-cost tier that still handles structured planning well. Typical brain dump:
          fractions of a cent. Your API key stays server-side only.
        </p>

        @if (aiReady()) {
          <p class="status ok">AI is ready — sign in and deploy functions to use live models.</p>
        } @else if (firebaseEnabled()) {
          <p class="status warn">Sign in and deploy Cloud Functions to enable live AI.</p>
        } @else {
          <p class="status warn">Configure Firebase first, then set up AI below.</p>
        }

        <ol class="setup-steps">
          <li>Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></li>
          <li>Set the secret: <code>firebase functions:secrets:set GEMINI_API_KEY</code></li>
          <li>Deploy functions: <code>pnpm run firebase:deploy:functions</code></li>
          <li>Sign in — brain dump, daily plan, and weekly review use Gemini automatically</li>
        </ol>
        <p class="hint">If AI is unavailable, Orderly falls back to the local parser.</p>
      </section>

      <section class="card">
        <h3>Firebase</h3>
        @if (firebaseEnabled()) {
          <p class="status ok">Configured for project <strong>{{ projectId() }}</strong></p>
        } @else {
          <p class="status warn">
            Not configured yet. Paste your web app config into
            <code>src/environments/environment.ts</code>.
          </p>
        }

        <ol class="setup-steps">
          <li>Create a Firebase project at console.firebase.google.com</li>
          <li>Add a Web app and copy the config object</li>
          <li>Enable Authentication → Google sign-in</li>
          <li>Create a Firestore database (production mode is fine)</li>
          <li>Deploy rules: <code>pnpm run firebase:deploy:rules</code></li>
        </ol>
      </section>

      <section class="card">
        <h3>Account</h3>
        @if (!firebaseEnabled()) {
          <p class="hint">Configure Firebase to enable sign-in and cloud sync.</p>
        } @else if (isAuthenticated()) {
          <div class="account-row">
            @if (photoUrl()) {
              <img [src]="photoUrl()!" [alt]="displayName() ?? 'Account'" class="avatar" />
            }
            <div>
              <p class="account-name">{{ displayName() }}</p>
              <p class="account-meta">Signed in with Google</p>
            </div>
          </div>
          <button type="button" class="btn-secondary" [disabled]="busy()" (click)="signOut()">
            {{ busy() ? 'Signing out…' : 'Sign out' }}
          </button>
        } @else {
          <p class="hint">You are not signed in. Data stays local until you authenticate.</p>
          <button type="button" class="btn-primary" [disabled]="busy()" (click)="signIn()">
            {{ busy() ? 'Signing in…' : 'Sign in with Google' }}
          </button>
        }

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </section>

      <section class="card">
        <h3>Planned integrations</h3>
        <ul>
          <li>Google Calendar — schedule awareness</li>
          <li>Gmail — admin and communication triage</li>
        </ul>
      </section>
    </div>
  `,
  styles: `
    .settings-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
    .subtitle { margin: 0.35rem 0 0; font-size: 0.875rem; color: var(--text-muted); }
    .card {
      background: var(--surface-0);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }
    h3 {
      margin: 0 0 0.85rem;
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }
    .status { margin: 0 0 1rem; font-size: 0.875rem; }
    .status.ok { color: #166534; }
    .status.warn { color: #92400e; }
    .setup-steps, ul {
      margin: 0;
      padding-left: 1.25rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
      line-height: 1.8;
    }
    a { color: var(--accent); }
    code {
      font-size: 0.8rem;
      background: var(--surface-1);
      padding: 0.1rem 0.35rem;
      border-radius: 0.35rem;
    }
    .hint { margin: 0 0 1rem; color: var(--text-muted); font-size: 0.875rem; }
    .account-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1rem;
    }
    .avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      object-fit: cover;
    }
    .account-name { margin: 0; font-weight: 600; color: var(--text-primary); }
    .account-meta { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--text-muted); }
    .btn-primary, .btn-secondary {
      border: none;
      border-radius: 999px;
      font: inherit;
      font-weight: 600;
      padding: 0.65rem 1rem;
      cursor: pointer;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary {
      background: var(--surface-1);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.7; cursor: wait; }
    .error {
      margin: 1rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: #fef2f2;
      color: #b91c1c;
      font-size: 0.875rem;
    }
  `,
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly aiBackend = inject(AiBackendService);

  readonly firebaseEnabled = computed(() => this.auth.firebaseEnabled);
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly aiReady = computed(() => this.aiBackend.isAvailable);
  readonly displayName = computed(() => this.auth.displayName());
  readonly photoUrl = computed(() => this.auth.photoUrl());
  readonly projectId = computed(() => environment.firebase.projectId);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    await this.runAuthAction(() => this.auth.signInWithGoogle());
  }

  async signOut(): Promise<void> {
    await this.runAuthAction(() => this.auth.signOut());
  }

  private async runAuthAction(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}
