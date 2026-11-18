import { ErrorHandler, Provider } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ERROR_REPORTER, HttpErrorReporter, NoopErrorReporter } from './error-reporter';
import { GlobalErrorHandler } from './global-error-handler';

/**
 * Opt-in: set `errorReportingUrl` in environment.ts (same-origin or https).
 * Empty or missing = reporting disabled. Never commit a real endpoint.
 */
export function provideErrorMonitoring(): Provider[] {
  const url = (environment as { errorReportingUrl?: string }).errorReportingUrl ?? '';
  return [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: ERROR_REPORTER,
      useFactory: () => (url ? new HttpErrorReporter(url) : new NoopErrorReporter()),
    },
  ];
}
