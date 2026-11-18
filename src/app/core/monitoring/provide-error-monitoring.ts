import { ErrorHandler, Provider } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ERROR_REPORTER, ErrorReporter, HttpErrorReporter, NoopErrorReporter } from './error-reporter';
import { GlobalErrorHandler } from './global-error-handler';
import { SentryErrorReporter, SentryFacade } from './sentry-error-reporter';

/** Optional monitoring fields of environment.ts. Never commit real values. */
export interface MonitoringConfig {
  /** Sentry DSN. Empty or missing = Sentry disabled. Takes precedence over errorReportingUrl. */
  sentryDsn?: string;
  /** Release name sent to Sentry (CI uses the git SHA). */
  release?: string;
  /** Plain JSON endpoint (same-origin or https). Empty or missing = disabled. */
  errorReportingUrl?: string;
}

/** Picks exactly one reporter: Sentry, then the HTTP endpoint, then no-op. */
export function createErrorReporter(config: MonitoringConfig, sentry?: SentryFacade): ErrorReporter {
  if (config.sentryDsn) {
    return new SentryErrorReporter({ dsn: config.sentryDsn, release: config.release }, sentry);
  }
  if (config.errorReportingUrl) return new HttpErrorReporter(config.errorReportingUrl);
  return new NoopErrorReporter();
}

/** Opt-in error reporting configured from environment.ts (see MonitoringConfig). */
export function provideErrorMonitoring(): Provider[] {
  return [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: ERROR_REPORTER,
      useFactory: () => createErrorReporter(environment as MonitoringConfig),
    },
  ];
}
