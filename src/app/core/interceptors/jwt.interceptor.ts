import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
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
 * Evita múltiples llamadas paralelas al endpoint `/refresh`.
 *
 * Vive a nivel de módulo porque `HttpInterceptorFn` no tiene una instancia
 * propia por request: Angular invoca la misma función para todas las requests
 * salientes de la app, así que este estado ya era efectivamente un singleton
 * (equivalente al `providedIn: 'root'` del interceptor basado en clase, que
 * también se registraba una única vez vía `HTTP_INTERCEPTORS`). La semántica
 * de refresh concurrente (encolar requests mientras `isRefreshing` es `true`
 * y liberarlas cuando `refreshTokenSubject` emite el nuevo token) se preserva
 * exactamente igual.
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

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
export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const sessionAlertService = inject(SessionAlertService);

  const token = authService.getAccessToken();

  if (token) {
    request = attachToken(request, token);
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = request.url.includes('/auth/');

      if (error.status === 401 && !isAuthEndpoint) {
        return handle401Error(request, next, error, authService, sessionAlertService);
      }

      return throwError(() => error);
    }),
  );
};

/**
 * Clasifica el 401:
 * - SESSION_OVERRIDDEN → logout inmediato + alerta de dispositivo.
 * - TOKEN_EXPIRED → logout inmediato + alerta de expiración.
 * - 401 genérico → intenta refresh silencioso; si falla, logout inmediato.
 */
function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  error: HttpErrorResponse,
  authService: AuthService,
  sessionAlertService: SessionAlertService,
): Observable<HttpEvent<unknown>> {
  const errorCode = extractErrorCode(error);

  if (errorCode === 'SESSION_OVERRIDDEN') {
    forceLogout('SESSION_OVERRIDDEN', authService, sessionAlertService);
    return throwError(() => error);
  }

  if (errorCode === 'TOKEN_EXPIRED') {
    forceLogout('TOKEN_EXPIRED', authService, sessionAlertService);
    return throwError(() => error);
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refresh().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);
        return next(attachToken(request, response.accessToken));
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        forceLogout('TOKEN_EXPIRED', authService, sessionAlertService);
        return throwError(() => refreshError);
      }),
    );
  }

  return refreshTokenSubject.pipe(
    filter((token) => token !== null),
    take(1),
    switchMap((token) => next(attachToken(request, token!))),
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
function forceLogout(
  alertType: 'SESSION_OVERRIDDEN' | 'TOKEN_EXPIRED',
  authService: AuthService,
  sessionAlertService: SessionAlertService,
): void {
  if (!authService.isLoggedIn) {
    return;
  }
  authService.logout();
  sessionAlertService.show(alertType);
}

/**
 * Extrae el código de error estructurado del cuerpo de la respuesta 401.
 * El backend envía `{ error: 'SESSION_OVERRIDDEN' | 'TOKEN_EXPIRED', message: '...' }`.
 */
function extractErrorCode(error: HttpErrorResponse): string | null {
  try {
    const body = error.error;
    if (typeof body === 'object' && body?.error) {
      return body.error as string;
    }
    if (typeof body?.message === 'string') {
      const parsed = JSON.parse(body.message);
      return parsed?.error ?? null;
    }
  } catch {}
  return null;
}

function attachToken(
  request: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return request.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}
