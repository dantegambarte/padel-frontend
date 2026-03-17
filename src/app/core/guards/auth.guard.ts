import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Route guard that protects private application routes.
 * Redirects unauthenticated users to `/auth/login`.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  /**
   * Checks whether the current user is authenticated.
   * Returns `true` to allow navigation or a {@link UrlTree} to redirect to the login page.
   */
  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.currentUser$.pipe(
      take(1),
      map((user) => {
        if (user) {
          return true;
        }
        return this.router.createUrlTree(['/auth/login']);
      }),
    );
  }
}
