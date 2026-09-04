import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
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
 * `CanActivateFn` y `CanActivateChildFn` comparten firma `(route, state)`, así que
 * este mismo guard se registra tanto en `canActivate` como en `canActivateChild`
 * para interceptar también la navegación entre child routes.
 */
function check(url: string): Observable<boolean | UrlTree> {
  const authService = inject(AuthService);
  const router = inject(Router);
  const sessionAlertService = inject(SessionAlertService);

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/auth/login']);
      }

      if (authService.isTokenExpired()) {
        sessionAlertService.show('TOKEN_EXPIRED');
        authService.logout();
        return false;
      }

      if (user.mustChangePassword && !url.startsWith('/app/account')) {
        return router.createUrlTree(['/app/account']);
      }

      return true;
    }),
  );
}

export const authGuard: CanActivateFn = (route, state) => check(state.url);
