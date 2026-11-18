import { InjectionToken } from '@angular/core';

/** A scrubbed, serializable error event. Never put tokens or personal data here. */
export interface ErrorReport {
  kind: 'uncaught' | 'http';
  message: string;
  timestamp: string;
  name?: string;
  stack?: string;
  status?: number;
  method?: string;
  url?: string;
  page?: string;
}

/** Pluggable sink for error reports (HTTP endpoint, Sentry adapter, ...). */
export interface ErrorReporter {
  report(report: ErrorReport): void;
}

/** Default reporter: does nothing beyond the console logging ErrorHandler already does. */
export class NoopErrorReporter implements ErrorReporter {
  report(): void {
    // Disabled: no reporting endpoint configured.
  }
}

/**
 * Posts reports as JSON with `fetch` (not HttpClient, so it never loops through
 * the interceptors and never carries the auth header or cookies). The endpoint
 * must be same-origin or https to pass the CSP `connect-src` directive.
 */
export class HttpErrorReporter implements ErrorReporter {
  constructor(private readonly endpoint: string) {}

  report(report: ErrorReport): void {
    try {
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        credentials: 'omit',
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Reporting must never break the app.
    }
  }
}

export const ERROR_REPORTER = new InjectionToken<ErrorReporter>('ERROR_REPORTER');
