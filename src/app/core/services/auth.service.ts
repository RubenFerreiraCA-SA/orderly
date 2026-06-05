import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  GoogleAuthProvider,
  authState,
  signInWithPopup,
  signOut,
  user,
} from '@angular/fire/auth';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isFirebaseConfigured } from '../../../environments/firebase-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth, { optional: true });

  readonly firebaseEnabled = isFirebaseConfigured(environment.firebase);
  readonly user = toSignal(this.auth ? user(this.auth) : of(null), { initialValue: null });
  readonly authReady = toSignal(this.auth ? authState(this.auth) : of(null), {
    initialValue: undefined,
  });
  readonly isAuthenticated = computed(() => !!this.user());
  readonly displayName = computed(() => this.user()?.displayName ?? this.user()?.email ?? null);
  readonly photoUrl = computed(() => this.user()?.photoURL ?? null);

  async signInWithGoogle(): Promise<void> {
    if (!this.auth) {
      throw new Error('Firebase is not configured yet.');
    }
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    if (!this.auth) {
      return;
    }
    await signOut(this.auth);
  }
}
