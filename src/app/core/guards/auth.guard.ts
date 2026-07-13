import { Injectable } from '@angular/core';
import { Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { SessionAlertService } from '../services/session-alert.service';

/**
 * Guard de ruta que protege las rutas privadas.
 *
 * Estrategia "Bulletproof Session" — CAPA 1:
 * 1. Redirige al login si no hay sesión activa (sin usuario en memoria).
 * 2. Verifica que el JWT no haya expirado ANTES de permitir el render del componente.
 *    Si el token expiró mid-session (entre navegaciones), limpia el estado, muestra
 *    la alerta de sesión expirada y cancela la navegación → el interceptor ya gestiona
 *    el caso de expiración detectada en una request HTTP saliente.
 * 3. Redirige a /app/account si mustChangePassword es true.
 *
 * Nota: el caso de arranque con token expirado queda resuelto en AuthService
 * (loadUserFromStorage limpia el storage → currentUser$ emite null → punto 1 activo).
 *
 * Implementa CanActivateChild para interceptar también la navegación entre child routes.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard  {
  constructor(
    private authService: AuthService,
    private router: Router,
    private sessionAlertService: SessionAlertService,
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

        if (this.authService.isTokenExpired()) {
          this.sessionAlertService.show('TOKEN_EXPIRED');
          this.authService.logout();
          return false;
        }

        if (user.mustChangePassword && !url.startsWith('/app/account')) {
          return this.router.createUrlTree(['/app/account']);
        }

        return true;
      }),
    );
  }
}
