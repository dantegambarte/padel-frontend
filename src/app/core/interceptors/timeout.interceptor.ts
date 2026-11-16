import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, throwError, timeout, TimeoutError } from 'rxjs';

/** Timeout por defecto de cualquier request HTTP. */
export const DEFAULT_HTTP_TIMEOUT_MS = 20_000;

/** Timeout extendido para exportaciones/descargas (Excel, blobs pesados). */
export const EXPORT_HTTP_TIMEOUT_MS = 120_000;

export const TIMEOUT_ERROR_MESSAGE = 'El servidor no respondió a tiempo. Intentá de nuevo.';

/**
 * Permite que cada request sobrescriba el timeout:
 * `context: new HttpContext().set(HTTP_TIMEOUT_MS, EXPORT_HTTP_TIMEOUT_MS)`.
 */
export const HTTP_TIMEOUT_MS = new HttpContextToken<number>(() => DEFAULT_HTTP_TIMEOUT_MS);

/**
 * Corta la request si el servidor no responde a tiempo y la convierte en un
 * `HttpErrorResponse` (status 0) con `error.message` en español, el mismo
 * formato que los componentes ya muestran vía `err?.error?.message`.
 *
 * Se registra DESPUÉS de `jwtInterceptor`: así el timeout se aplica a cada
 * intento individual (incluido el reintento tras el refresh) y nunca corta
 * la espera del refresh en sí, que tiene su propio timeout como request aparte.
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(req.context.get(HTTP_TIMEOUT_MS)),
    catchError((err) =>
      throwError(() =>
        err instanceof TimeoutError
          ? new HttpErrorResponse({
              status: 0,
              statusText: 'Timeout',
              url: req.urlWithParams,
              error: { message: TIMEOUT_ERROR_MESSAGE },
            })
          : err,
      ),
    ),
  );
