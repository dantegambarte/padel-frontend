import type { BrowserOptions, ErrorEvent } from '@sentry/angular';

import { ErrorReport, ErrorReporter } from './error-reporter';
import { scrub, stripQuery } from './scrub';

/** The slice of the Sentry SDK this adapter uses (injectable for tests). */
export interface SentryFacade {
  init(options: BrowserOptions): unknown;
  captureException(exception: unknown, hint?: { tags?: Record<string, string> }): unknown;
  captureMessage(message: string, hint?: { level?: 'error'; tags?: Record<string, string> }): unknown;
}

export interface SentryReporterOptions {
  dsn: string;
  release?: string;
}

/**
 * Last line of defense before an event leaves the browser: applies the same
 * scrubber as every other reporter and drops user, cookies, headers and
 * breadcrumbs (which may carry URLs with personal data).
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrub(ex.value);
  }
  if (event.request) {
    event.request = event.request.url ? { url: stripQuery(event.request.url) } : {};
  }
  delete event.user;
  delete event.breadcrumbs;
  return event;
}

/**
 * Sends reports to Sentry. Our GlobalErrorHandler and errorReportingInterceptor
 * stay the only capture paths: Sentry's default integrations (global handlers,
 * breadcrumbs, ...) are disabled so nothing is reported twice. The SDK is
 * loaded lazily so it is not in the initial bundle when Sentry is disabled.
 */
export class SentryErrorReporter implements ErrorReporter {
  private sentry?: SentryFacade;
  private pending: ErrorReport[] = [];

  constructor(options: SentryReporterOptions, sentry?: SentryFacade) {
    const start = (sdk: SentryFacade) => {
      sdk.init({
        dsn: options.dsn,
        release: options.release || undefined,
        // SDK v11 replaced `sendDefaultPii: false` with dataCollection: collect nothing.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        defaultIntegrations: false,
        beforeSend: scrubSentryEvent,
      });
      this.sentry = sdk;
      const queued = this.pending;
      this.pending = [];
      queued.forEach((r) => this.report(r));
    };
    if (sentry) {
      start(sentry);
    } else {
      import('@sentry/angular').then(start).catch(() => (this.pending = []));
    }
  }

  report(report: ErrorReport): void {
    if (!this.sentry) {
      if (this.pending.length < 20) this.pending.push(report);
      return;
    }
    try {
      const tags: Record<string, string> = { kind: report.kind };
      if (report.page) tags['page'] = report.page;
      if (report.status !== undefined) tags['status'] = String(report.status);
      if (report.method) tags['method'] = report.method;
      if (report.url) tags['url'] = report.url;

      if (report.kind === 'uncaught') {
        const error = new Error(report.message);
        if (report.name) error.name = report.name;
        error.stack = report.stack;
        this.sentry.captureException(error, { tags });
      } else {
        this.sentry.captureMessage(report.message, { level: 'error', tags });
      }
    } catch {
      // Reporting must never break the app.
    }
  }
}
