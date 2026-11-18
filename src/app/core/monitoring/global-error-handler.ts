import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ERROR_REPORTER } from './error-reporter';
import { scrub, stripQuery } from './scrub';

/** Reports uncaught errors to the configured ErrorReporter, keeping console output. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly reporter = inject(ERROR_REPORTER);

  handleError(error: unknown): void {
    console.error(error);
    // HTTP failures are reported (5xx only) by errorReportingInterceptor.
    if (error instanceof HttpErrorResponse) return;
    const err = error instanceof Error ? error : new Error(String(error));
    try {
      this.reporter.report({
        kind: 'uncaught',
        name: err.name,
        message: scrub(err.message),
        stack: err.stack ? scrub(err.stack) : undefined,
        page: stripQuery(location.pathname),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Reporting must never break the app.
    }
  }
}
