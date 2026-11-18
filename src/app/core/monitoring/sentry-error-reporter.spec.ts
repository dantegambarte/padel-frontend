import type { ErrorEvent } from '@sentry/angular';

import { ErrorReport } from './error-reporter';
import { createErrorReporter } from './provide-error-monitoring';
import { HttpErrorReporter, NoopErrorReporter } from './error-reporter';
import { SentryErrorReporter, SentryFacade, scrubSentryEvent } from './sentry-error-reporter';

function fakeSentry(): jasmine.SpyObj<SentryFacade> {
  return jasmine.createSpyObj<SentryFacade>('Sentry', ['init', 'captureException', 'captureMessage']);
}

describe('SentryErrorReporter', () => {
  it('initializes without PII, without global handlers, with release and scrubbing beforeSend', () => {
    const sentry = fakeSentry();
    new SentryErrorReporter({ dsn: 'https://key@sentry.example.test/1', release: 'abc123' }, sentry);
    const opts = sentry.init.calls.mostRecent().args[0];
    expect(opts.dsn).toBe('https://key@sentry.example.test/1');
    expect(opts.release).toBe('abc123');
    expect(opts.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    // Our ErrorHandler and interceptor are the only capture paths: no double reporting.
    expect(opts.defaultIntegrations).toBeFalse();
    expect(opts.beforeSend).toBe(scrubSentryEvent);
  });

  it('omits release when not configured', () => {
    const sentry = fakeSentry();
    new SentryErrorReporter({ dsn: 'https://key@sentry.example.test/1' }, sentry);
    expect(sentry.init.calls.mostRecent().args[0].release).toBeUndefined();
  });

  it('captures uncaught reports once as an exception keeping name and stack', () => {
    const sentry = fakeSentry();
    const reporter = new SentryErrorReporter({ dsn: 'd' }, sentry);
    const report: ErrorReport = {
      kind: 'uncaught',
      name: 'TypeError',
      message: 'x is undefined',
      stack: 'TypeError: x is undefined\n    at main.js:1:2',
      page: '/bookings',
      timestamp: 't',
    };
    reporter.report(report);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
    const [err, ctx] = sentry.captureException.calls.mostRecent().args as [Error, { tags: object }];
    expect(err.name).toBe('TypeError');
    expect(err.message).toBe('x is undefined');
    expect(err.stack).toBe(report.stack);
    expect(ctx.tags).toEqual(jasmine.objectContaining({ kind: 'uncaught', page: '/bookings' }));
  });

  it('captures http reports once as a message with status, method and url tags', () => {
    const sentry = fakeSentry();
    new SentryErrorReporter({ dsn: 'd' }, sentry).report({
      kind: 'http',
      message: 'HTTP 503 GET',
      status: 503,
      method: 'GET',
      url: '/api/v1/bookings',
      timestamp: 't',
    });
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).not.toHaveBeenCalled();
    const [msg, ctx] = sentry.captureMessage.calls.mostRecent().args as [string, { tags: object }];
    expect(msg).toBe('HTTP 503 GET');
    expect(ctx.tags).toEqual(
      jasmine.objectContaining({ kind: 'http', status: '503', method: 'GET', url: '/api/v1/bookings' }),
    );
  });

  it('never throws when Sentry fails', () => {
    const sentry = fakeSentry();
    sentry.captureMessage.and.throwError('down');
    const reporter = new SentryErrorReporter({ dsn: 'd' }, sentry);
    expect(() =>
      reporter.report({ kind: 'http', message: 'm', timestamp: 't' }),
    ).not.toThrow();
  });
});

describe('scrubSentryEvent', () => {
  it('scrubs message, exception values, request url and drops user, cookies and breadcrumbs', () => {
    const event = {
      message: 'failed for a@b.com',
      exception: {
        values: [{ type: 'Error', value: 'Bearer abc.def token for x@y.com' }],
      },
      request: {
        url: 'https://app.example.test/bookings?email=x@y.com',
        cookies: { sid: 'secret' },
        headers: { Authorization: 'Bearer secret' },
      },
      user: { email: 'a@b.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'clicked a@b.com' }],
    } as unknown as ErrorEvent;

    const out = scrubSentryEvent(event)!;
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('a@b.com');
    expect(serialized).not.toContain('x@y.com');
    expect(serialized).not.toContain('secret');
    expect(out.request?.url).toBe('https://app.example.test/bookings');
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
  });
});

describe('createErrorReporter', () => {
  it('prefers Sentry when a DSN is set', () => {
    const sentry = fakeSentry();
    const reporter = createErrorReporter({ sentryDsn: 'd', errorReportingUrl: 'https://e' }, sentry);
    expect(reporter).toEqual(jasmine.any(SentryErrorReporter));
  });

  it('falls back to the HTTP reporter, then to no-op', () => {
    expect(createErrorReporter({ errorReportingUrl: 'https://e' })).toEqual(jasmine.any(HttpErrorReporter));
    expect(createErrorReporter({ sentryDsn: '' })).toEqual(jasmine.any(NoopErrorReporter));
  });
});
