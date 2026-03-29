import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import {
  Observable,
  throwError,
  BehaviorSubject,
  switchMap,
  filter,
  take,
  catchError,
} from 'rxjs';

import { AuthService } from '../services/auth.service';
import { SessionAlertService } from '../services/session-alert.service';

/**
 * Interceptor HTTP que:
 * 1. Adjunta el Bearer token a cada request saliente.
 * 2. Detecta errores 401 y los clasifica:
 *    - SESSION_OVERRIDDEN → logout inmediato + alerta de dispositivo.
 *    - TOKEN_EXPIRED / refresh fallido → logout inmediato + alerta de expiración.
 *    - 401 genérico → intenta renovar el token silenciosamente (refresh flow).
 *    - 403 Forbidden → NO dispara logout. El usuario no tiene permiso pero su sesión
 *      es válida. El error se propaga para que el componente lo maneje.
 *
 * COMPORTAMIENTO CLAVE: ante sesión inválida confirmada se llama a `authService.logout()`
 * de forma inmediata (antes de mostrar la alerta) para que el Router navegue al login
 * y destruya cualquier componente parcialmente renderizado. La alerta modal sigue visible
 * encima de la pantalla de login hasta que el usuario la confirma.
 *
 * Las requests concurrentes durante el refresh se encolan y se reintentan
 * una vez que el nuevo access token está disponible.
 */
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  /** Evita múltiples llamadas paralelas al endpoint `/refresh`. */
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private sessionAlertService: SessionAlertService,
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = this.authService.getAccessToken();

    if (token) {
      request = this.attachToken(request, token);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const isAuthEndpoint = request.url.includes('/auth/');

        if (error.status === 401 && !isAuthEndpoint) {
          return this.handle401Error(request, next, error);
        }

        // 403 en rutas protegidas: el usuario no tiene permisos pero su sesión ES válida.
        // NO se dispara logout — propagar el error para que el componente lo maneje.
        return throwError(() => error);
      }),
    );
  }

  /**
   * Clasifica el 401:
   * - SESSION_OVERRIDDEN → logout inmediato + alerta de dispositivo.
   * - TOKEN_EXPIRED → logout inmediato + alerta de expiración.
   * - 401 genérico → intenta refresh silencioso; si falla, logout inmediato.
   */
  private handle401Error(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    error: HttpErrorResponse,
  ): Observable<HttpEvent<unknown>> {
    const errorCode = this.extractErrorCode(error);

    if (errorCode === 'SESSION_OVERRIDDEN') {
      this.forceLogout('SESSION_OVERRIDDEN');
      return throwError(() => error);
    }

    if (errorCode === 'TOKEN_EXPIRED') {
      this.forceLogout('TOKEN_EXPIRED');
      return throwError(() => error);
    }

    // 401 genérico: intentar renovar con el refresh token
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refresh().pipe(
        switchMap((response) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.accessToken);
          return next.handle(this.attachToken(request, response.accessToken));
        }),
        catchError((refreshError) => {
          this.isRefreshing = false;
          // El refresh falló → el refresh token también expiró o es inválido.
          // Logout inmediato para evitar UI en estado parcial.
          this.forceLogout('TOKEN_EXPIRED');
          return throwError(() => refreshError);
        }),
      );
    }

    // Ya hay un refresh en curso — encolar esta request
    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next.handle(this.attachToken(request, token!))),
    );
  }

  /**
   * Ejecuta el logout inmediato y muestra la alerta de sesión.
   *
   * Usa `authService.isLoggedIn` como guardia para que requests concurrentes
   * que reciban 401/403 simultáneamente no disparen múltiples navegaciones.
   * Después del primer `logout()`, `isLoggedIn` es false y las llamadas
   * siguientes son descartadas silenciosamente.
   */
  private forceLogout(alertType: 'SESSION_OVERRIDDEN' | 'TOKEN_EXPIRED'): void {
    if (!this.authService.isLoggedIn) {
      // Sesión ya fue limpiada por otra request concurrente → no hacer nada.
      return;
    }
    // 1. Limpia todo el estado local y navega a /auth/login de forma inmediata.
    //    Esto destruye los componentes parcialmente renderizados.
    this.authService.logout();
    // 2. Muestra la alerta encima de la pantalla de login.
    //    El usuario confirma y `SessionAlertComponent.confirm()` llama
    //    a logout() nuevamente (operación idempotente).
    this.sessionAlertService.show(alertType);
  }

  /**
   * Extrae el código de error estructurado del cuerpo de la respuesta 401.
   * El backend envía `{ error: 'SESSION_OVERRIDDEN' | 'TOKEN_EXPIRED', message: '...' }`.
   */
  private extractErrorCode(error: HttpErrorResponse): string | null {
    try {
      const body = error.error;
      if (typeof body === 'object' && body?.error) {
        return body.error as string;
      }
      // Algunos backends anidan el mensaje en body.message como JSON
      if (typeof body?.message === 'string') {
        const parsed = JSON.parse(body.message);
        return parsed?.error ?? null;
      }
    } catch {
      // no parseable
    }
    return null;
  }

  private attachToken(
    request: HttpRequest<unknown>,
    token: string,
  ): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
}
