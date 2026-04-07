import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Guard de ruta que restringe el acceso exclusivamente al rol ADMIN.
 *
 * SEGURIDAD — CAPA 2 (Navegación):
 * Si un usuario autenticado con rol 'employee' intenta acceder directamente
 * a una ruta protegida, es redirigido silenciosamente al dashboard.
 * Se combina con AuthGuard (ya aplicado en el padre /app).
 */
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> {
    return this.authService.currentUser$.pipe(
      take(1),
      map((user) => {
        if (user?.role === 'admin') {
          return true;
        }
        return this.router.createUrlTree(['/app/dashboard']);
      }),
    );
  }
}
