import { Injectable } from '@angular/core';
import { Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Guard genérico de control de acceso por rol (RBAC).
 *
 * SEGURIDAD — CAPA 2 (Navegación):
 * Complementa al AuthGuard (capa 1, que verifica autenticación).
 * Este guard verifica AUTORIZACIÓN: si el usuario tiene el rol requerido.
 *
 * Uso en el archivo de rutas:
 * ```ts
 * {
 *   path: 'fixed-bookings',
 *   canActivate: [AdminGuard],
 *   data: { roles: ['admin'] },
 * }
 * ```
 *
 * Si `data.roles` está ausente o vacío, se deniega el acceso por defecto
 * (fail-secure: mejor bloquear de más que de menos).
 *
 * Si el usuario no tiene el rol requerido, es redirigido silenciosamente
 * al dashboard sin que el módulo lazy llegue siquiera a descargarse.
 *
 * Exportado como `AdminGuard` para mantener compatibilidad con los imports
 * existentes en inventory-routing y teachers-routing.
 */
@Injectable({ providedIn: 'root' })
export class AdminGuard  {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> {
    const allowedRoles: string[] = route.data?.['roles'] ?? [];

    return this.authService.currentUser$.pipe(
      take(1),
      map((user) => {
        const userRole = user?.role ?? '';

        if (allowedRoles.length > 0 && allowedRoles.includes(userRole)) {
          return true;
        }

        return this.router.createUrlTree(['/app/dashboard']);
      }),
    );
  }
}
