import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Guard genérico de control de acceso por rol (RBAC).
 *
 * SEGURIDAD — CAPA 2 (Navegación):
 * Complementa al authGuard (capa 1, que verifica autenticación).
 * Este guard verifica AUTORIZACIÓN: si el usuario tiene el rol requerido.
 *
 * Uso en el archivo de rutas:
 * ```ts
 * {
 *   path: 'fixed-bookings',
 *   canActivate: [adminGuard],
 *   data: { roles: ['admin'] },
 * }
 * ```
 *
 * Si `data.roles` está ausente o vacío, se deniega el acceso por defecto
 * (fail-secure: mejor bloquear de más que de menos).
 *
 * Si el usuario no tiene el rol requerido, es redirigido silenciosamente
 * al dashboard sin que el módulo lazy llegue siquiera a descargarse.
 */
export const adminGuard: CanActivateFn = (
  route,
  _state,
): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles: string[] = route.data?.['roles'] ?? [];

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      const userRole = user?.role ?? '';

      if (allowedRoles.length > 0 && allowedRoles.includes(userRole)) {
        return true;
      }

      return router.createUrlTree(['/app/dashboard']);
    }),
  );
};
