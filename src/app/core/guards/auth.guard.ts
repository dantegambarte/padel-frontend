import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Guard de ruta que protege las rutas privadas.
 * - Redirige al login si no hay sesión activa.
 * - Redirige a /app/account (y bloquea todas las demás rutas) si mustChangePassword es true.
 * Implementa CanActivateChild para interceptar también la navegación entre child routes.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> {
    return this.check(state.url);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> {
    return this.check(state.url);
  }

  private check(url: string): Observable<boolean | UrlTree> {
    return this.authService.currentUser$.pipe(
      take(1),
      map((user) => {
        if (!user) {
          return this.router.createUrlTree(['/auth/login']);
        }
        if (user.mustChangePassword && !url.startsWith('/app/account')) {
          return this.router.createUrlTree(['/app/account']);
        }
        return true;
      }),
    );
  }
}
