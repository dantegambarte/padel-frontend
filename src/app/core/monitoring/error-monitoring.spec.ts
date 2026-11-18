import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ErrorReport, ERROR_REPORTER, ErrorReporter, HttpErrorReporter } from './error-reporter';
import { errorReportingInterceptor } from './error-reporting.interceptor';
import { provideErrorMonitoring } from './provide-error-monitoring';
import { scrub } from './scrub';

describe('scrub', () => {
  it('removes bearer tokens, JWTs, emails and query strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_DEF-123';
    const out = scrub(
      `Bearer abc.def.ghi failed for john.doe@example.com token ${jwt} at http://localhost:3000/api/v1/users?email=x@y.com&token=secret`,
    );
    expect(out).not.toContain('abc.def.ghi');
    expect(out).not.toContain('john.doe@example.com');
    expect(out).not.toContain(jwt);
    expect(out).not.toContain('secret');
    expect(out).toContain('http://localhost:3000/api/v1/users');
    expect(out).toContain('[redacted]');
  });
});

describe('error monitoring', () => {
  let reports: ErrorReport[];
  let handler: ErrorHandler;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    reports = [];
    const reporter: ErrorReporter = { report: (r) => reports.push(r) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorReportingInterceptor])),
        provideHttpClientTesting(),
        provideErrorMonitoring(),
        { provide: ERROR_REPORTER, useValue: reporter },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => httpMock.verify());

  it('reports uncaught errors with scrubbed message and stack', () => {
    handler.handleError(new Error('boom for a@b.com'));
    expect(reports.length).toBe(1);
    expect(reports[0].kind).toBe('uncaught');
    expect(reports[0].message).toBe('boom for [redacted]');
    expect(reports[0].stack).toBeDefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('never throws when the reporter fails', () => {
    TestBed.inject(ERROR_REPORTER).report = () => {
      throw new Error('reporter down');
    };
    expect(() => handler.handleError(new Error('x'))).not.toThrow();
  });

  it('does not report HTTP errors reaching the handler (the interceptor owns them)', () => {
    handler.handleError(new HttpErrorResponse({ status: 500, url: '/api' }));
    expect(reports.length).toBe(0);
  });

  it('reports 5xx responses with status, method and query-less URL, then rethrows', () => {
    let rethrown: HttpErrorResponse | undefined;
    http.get('/api/v1/bookings?date=2026-01-01').subscribe({ error: (e) => (rethrown = e) });
    httpMock
      .expectOne('/api/v1/bookings?date=2026-01-01')
      .flush('fail', { status: 503, statusText: 'Unavailable' });

    expect(rethrown?.status).toBe(503);
    expect(reports.length).toBe(1);
    expect(reports[0]).toEqual(
      jasmine.objectContaining({ kind: 'http', status: 503, method: 'GET', url: '/api/v1/bookings' }),
    );
  });

  it('does not report 4xx responses', () => {
    http.get('/api/x').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/x').flush('no', { status: 404, statusText: 'Not Found' });
    expect(reports.length).toBe(0);
  });
});

describe('HttpErrorReporter', () => {
  it('posts the report as JSON without credentials', () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response());
    const report: ErrorReport = { kind: 'uncaught', message: 'x', timestamp: 't' };
    new HttpErrorReporter('https://errors.example.test/ingest').report(report);
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe('https://errors.example.test/ingest');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual(report);
  });

  it('swallows network failures', async () => {
    spyOn(window, 'fetch').and.rejectWith(new TypeError('offline'));
    expect(() =>
      new HttpErrorReporter('https://errors.example.test').report({
        kind: 'uncaught',
        message: 'x',
        timestamp: 't',
      }),
    ).not.toThrow();
  });
});
