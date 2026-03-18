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
 *    - SESSION_OVERRIDDEN → muestra alerta y hace logout inmediato.
 *    - TOKEN_EXPIRED / refresh fallido → muestra alerta de expiración y hace logout.
 *    - 401 genérico → intenta renovar el token silenciosamente (refresh flow).
 *
 * Las requests concurrentes durante el refresh se encolan y se reintentan
 * una vez que el nuevo access token está disponible.
 */
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  /**
   * Evita múltiples llamadas paralelas al endpoint `/refresh`.
   */
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
        if (error.status === 401 && !request.url.includes('/auth/')) {
          return this.handle401Error(request, next, error);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Clasifica el 401:
   * - SESSION_OVERRIDDEN → logout + alerta de dispositivo.
   * - Refresh fallido / TOKEN_EXPIRED → logout + alerta de expiración.
   * - 401 genérico → intenta refresh silencioso.
   */
  private handle401Error(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    error: HttpErrorResponse,
  ): Observable<HttpEvent<unknown>> {
    const errorCode = this.extractErrorCode(error);

    // Sesión sobreescrita por otro dispositivo — no intentar refresh
    if (errorCode === 'SESSION_OVERRIDDEN') {
      this.sessionAlertService.show('SESSION_OVERRIDDEN');
      return throwError(() => error);
    }

    // Token expirado explícito del backend — no intentar refresh con el mismo token
    if (errorCode === 'TOKEN_EXPIRED') {
      this.sessionAlertService.show('TOKEN_EXPIRED');
      return throwError(() => error);
    }

    // 401 genérico: intentar renovar el token con el refresh token
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
          // El refresh falló (refresh token expirado o inválido)
          this.sessionAlertService.show('TOKEN_EXPIRED');
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
