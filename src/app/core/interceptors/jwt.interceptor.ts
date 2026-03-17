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

/**
 * Interceptor HTTP que adjunta el Bearer token a cada request saliente
 * y gestiona la renovación transparente del token ante respuestas 401.
 *
 * Las requests concurrentes que reciben un 401 mientras ya hay un refresh en curso
 * se encolan y se reintentan una vez que el nuevo access token está disponible.
 */
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  /**
   * Evita múltiples llamadas paralelas al endpoint `/refresh`.
   * Cuando `isRefreshing` es `true`, las demás requests se encolan en `refreshTokenSubject`.
   */
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthService) {}

  /**
   * Intercepta cada request HTTP, adjunta el access token actual si existe
   * y delega los errores 401 a {@link handle401Error}.
   */
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
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Intenta renovar el access token al recibir un 401 fuera de los endpoints de auth.
   * Si ya hay un refresh en curso, encola la request hasta que el nuevo token esté listo.
   * Dispara el logout automático cuando el refresh falla.
   */
  private handle401Error(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refresh().pipe(
        switchMap((response) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.accessToken);
          return next.handle(this.attachToken(request, response.accessToken));
        }),
        catchError((error) => {
          this.isRefreshing = false;
          this.authService.logout();
          return throwError(() => error);
        }),
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next.handle(this.attachToken(request, token!))),
    );
  }

  /**
   * Clona la request dada y establece el header `Authorization: Bearer <token>`.
   * @param request - Request HTTP original.
   * @param token   - Cadena del access token.
   */
  private attachToken(
    request: HttpRequest<unknown>,
    token: string,
  ): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
}
