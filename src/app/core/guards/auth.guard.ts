import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Guard de ruta que protege las rutas privadas.
 * Redirige al login a los usuarios no autenticados.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  /**
   * Verifica si el usuario actual está autenticado.
   * Devuelve `true` para permitir la navegación o un {@link UrlTree} para redirigir al login.
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
