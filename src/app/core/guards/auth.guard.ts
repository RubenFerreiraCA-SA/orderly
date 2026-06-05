import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authState } from '@angular/fire/auth';
import { Auth } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.firebaseEnabled) {
    return true;
  }

  const auth = inject(Auth);
  return authState(auth).pipe(
    take(1),
    map((user) => (user ? true : router.createUrlTree(['/login'])))
  );
};

export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.firebaseEnabled) {
    return router.createUrlTree(['/dashboard']);
  }

  const auth = inject(Auth);
  return authState(auth).pipe(
    take(1),
    map((user) => (user ? router.createUrlTree(['/dashboard']) : true))
  );
};
