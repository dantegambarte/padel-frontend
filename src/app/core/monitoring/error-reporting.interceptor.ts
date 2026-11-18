import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ERROR_REPORTER } from './error-reporter';
import { scrub, stripQuery } from './scrub';

/**
 * Reports server failures (5xx), which components usually catch and so never
 * reach the global ErrorHandler. The error is always rethrown unchanged.
 */
export const errorReportingInterceptor: HttpInterceptorFn = (req, next) => {
  const reporter = inject(ERROR_REPORTER);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status >= 500) {
        try {
          reporter.report({
            kind: 'http',
            message: scrub(`HTTP ${error.status} ${req.method}`),
            status: error.status,
            method: req.method,
            url: stripQuery(req.url),
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Reporting must never break the request flow.
        }
      }
      return throwError(() => error);
    }),
  );
};
