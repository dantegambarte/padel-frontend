import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import {
  DEFAULT_HTTP_TIMEOUT_MS,
  EXPORT_HTTP_TIMEOUT_MS,
  HTTP_TIMEOUT_MS,
  TIMEOUT_ERROR_MESSAGE,
  timeoutInterceptor,
} from './timeout.interceptor';

describe('timeoutInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([timeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('uses 20s by default and 120s for exports', () => {
    expect(DEFAULT_HTTP_TIMEOUT_MS).toBe(20_000);
    expect(EXPORT_HTTP_TIMEOUT_MS).toBe(120_000);
  });

  it('does not fail before the default timeout and succeeds when the response arrives', fakeAsync(() => {
    let result: unknown;
    let error: unknown;
    http.get('/api/x').subscribe({ next: (r) => (result = r), error: (e) => (error = e) });
    const req = httpMock.expectOne('/api/x');
    tick(DEFAULT_HTTP_TIMEOUT_MS - 1);
    expect(error).toBeUndefined();
    req.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  }));

  it('errors at the default timeout with a clear Spanish message', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });
    const req = httpMock.expectOne('/api/x');
    tick(DEFAULT_HTTP_TIMEOUT_MS);
    expect(error).toEqual(jasmine.any(HttpErrorResponse));
    expect(error!.status).toBe(0);
    expect(error!.url).toBe('/api/x');
    expect(error!.error?.message).toBe(TIMEOUT_ERROR_MESSAGE);
    expect(TIMEOUT_ERROR_MESSAGE).toBe('El servidor no respondió a tiempo. Intentá de nuevo.');
    expect(req.cancelled).toBeTrue();
  }));

  it('honors a per-request override via HTTP_TIMEOUT_MS', fakeAsync(() => {
    let error: unknown;
    http
      .get('/api/export', {
        responseType: 'blob',
        context: new HttpContext().set(HTTP_TIMEOUT_MS, EXPORT_HTTP_TIMEOUT_MS),
      })
      .subscribe({ error: (e) => (error = e) });
    httpMock.expectOne('/api/export');
    tick(DEFAULT_HTTP_TIMEOUT_MS);
    expect(error).toBeUndefined();
    tick(EXPORT_HTTP_TIMEOUT_MS - DEFAULT_HTTP_TIMEOUT_MS - 1);
    expect(error).toBeUndefined();
    tick(1);
    expect((error as HttpErrorResponse).error?.message).toBe(TIMEOUT_ERROR_MESSAGE);
  }));

  it('passes non-timeout errors through unchanged', fakeAsync(() => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/x').subscribe({ error: (e) => (error = e) });
    httpMock.expectOne('/api/x').flush({ message: 'boom' }, { status: 500, statusText: 'err' });
    expect(error!.status).toBe(500);
    expect(error!.error.message).toBe('boom');
  }));
});
