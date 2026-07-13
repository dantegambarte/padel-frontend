import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CashService } from './cash.service';
import { environment } from '../../../environments/environment';

describe('CashService', () => {
  let service: CashService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/cash`;

  const apiResponseOpen = {
    session: {
      id: 'sess1',
      status: 'open',
      date: '2026-01-01',
      openedAt: '2026-01-01T09:00:00Z',
      initialBalance: 5000,
      openedByUser: { fullName: 'Admin Test' },
    },
    cashIncome: 10000,
    cashExpenseTotal: 1000,
    cashExpected: 9000,
    transferTotal: 3000,
    dayTotal: 12000,
    initialBalance: 5000,
    isOpen: true,
    staleSession: false,
    isBusinessDayClosed: false,
    hasPendingClosures: false,
    transactions: [
      {
        id: 't1',
        type: 'booking',
        referenceId: 'b1',
        concept: 'Turno Juan',
        amountCash: '3000',
        amountTransfer: '0',
        createdAt: '2026-01-01T10:00:00Z',
        createdByFullName: 'Admin Test',
      },
      {
        id: 't2',
        type: 'expense',
        referenceId: 'e1',
        concept: 'Pelotas',
        amountCash: '500',
        amountTransfer: '0',
        createdAt: '2026-01-01T11:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CashService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getCurrent() maps the raw API response into CashCurrentResponse', (done) => {
    service.getCurrent().subscribe((res) => {
      expect(res.sessionId).toBe('sess1');
      expect(res.noSession).toBe(false);
      expect(res.isClosed).toBe(false);
      expect(res.efectivoEsperado).toBe(9000);
      expect(res.transferenciaTotal).toBe(3000);
      expect(res.openedByName).toBe('Admin Test');
      expect(res.movimientos.length).toBe(2);
      // Booking transaction with cash > 0 -> 'Efectivo', amount = cash + transfer.
      expect(res.movimientos[0].tipo).toBe('Efectivo');
      expect(res.movimientos[0].monto).toBe(3000);
      // Expense transaction -> always 'Efectivo', negative amount.
      expect(res.movimientos[1].movType).toBe('EXPENSE');
      expect(res.movimientos[1].monto).toBe(-500);
      expect(res.movimientos[1].userName).toBe('Administrador');
      done();
    });
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);
  });

  it('getCurrent() caches the observable across subsequent subscribers', () => {
    service.getCurrent().subscribe();
    service.getCurrent().subscribe();
    const reqs = httpMock.match(`${url}/current`);
    expect(reqs.length).toBe(1);
    reqs[0].flush(apiResponseOpen);
  });

  it('getCurrent() returns a synthetic "no session" response on 404 without throwing', (done) => {
    service.getCurrent().subscribe((res) => {
      expect(res.noSession).toBe(true);
      expect(res.sessionId).toBeNull();
      done();
    });
    httpMock
      .expectOne(`${url}/current`)
      .flush('not found', { status: 404, statusText: 'Not Found' });
  });

  it('getCurrent() clears its cache and rethrows on non-404 errors', (done) => {
    service.getCurrent().subscribe({
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });
    httpMock
      .expectOne(`${url}/current`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
  });

  it('getCurrent() cache expires after the 10s TTL', fakeAsync(() => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);

    tick(10_000);

    service.getCurrent().subscribe();
    const secondReq = httpMock.expectOne(`${url}/current`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush(apiResponseOpen);
    tick(10_000); // flush the second TTL timer so nothing leaks into the next test
  }));

  it('clearCurrentCache() forces a fresh GET on the next getCurrent() call', () => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);

    service.clearCurrentCache();

    service.getCurrent().subscribe();
    const secondReq = httpMock.expectOne(`${url}/current`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush(apiResponseOpen);
  });

  it('getLastClosedSuggestion() resolves to null on error instead of throwing', (done) => {
    service.getLastClosedSuggestion().subscribe((res) => {
      expect(res).toEqual({ cashCounted: null });
      done();
    });
    httpMock
      .expectOne(`${url}/sessions/suggestion`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
  });

  it('open() POSTs to /cash/sessions and clears the current cache', () => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);

    service.open({ initialBalance: 5000 }).subscribe();
    const req = httpMock.expectOne(`${url}/sessions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ initialBalance: 5000 });
    req.flush({ id: 's1', date: '2026-01-01', status: 'open' });

    // Cache invalidated -> a new getCurrent() hits the server again.
    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);
  });

  it('open() includes notes and conflictAction only when provided', () => {
    service
      .open({ initialBalance: 5000, notes: 'nota', conflictAction: 'reopen_today' })
      .subscribe();
    const req = httpMock.expectOne(`${url}/sessions`);
    expect(req.request.body).toEqual({
      initialBalance: 5000,
      notes: 'nota',
      conflictAction: 'reopen_today',
    });
    req.flush({ id: 's1', date: '2026-01-01', status: 'open' });
  });

  it('getDailySummary() sends the date as a query param', () => {
    service.getDailySummary('2026-01-01').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${url}/daily-summary` && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ date: '2026-01-01', totalExpected: 0, totalCounted: null, sessions: [] });
  });

  it('exportSession() requests a blob response type', () => {
    service.exportSession('sess1').subscribe();
    const req = httpMock.expectOne(`${url}/export/session/sess1`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('exportDaily() requests a blob response type with the date param', () => {
    service.exportDaily('2026-01-01').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${url}/export/daily` && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('closeDay() POSTs to /cash/daily-closures and clears the current cache', () => {
    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);

    service.closeDay().subscribe();
    const req = httpMock.expectOne(`${url}/daily-closures`);
    expect(req.request.method).toBe('POST');
    req.flush({ date: '2026-01-01', totalExpected: 0, totalCounted: 0, sessions: [] });

    service.getCurrent().subscribe();
    httpMock.expectOne(`${url}/current`).flush(apiResponseOpen);
  });

  it('close() PATCHes /cash/sessions/current, omitting empty notes, and clears the cache', () => {
    service.close({ efectivoContado: 9000, notas: '' }).subscribe();
    const req = httpMock.expectOne(`${url}/sessions/current`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ cashCounted: 9000 });
    req.flush({ id: 'sess1', closedAt: '2026-01-01T20:00:00Z', diferencia: 0 });
  });

  it('close() includes notes when non-empty', () => {
    service.close({ efectivoContado: 9000, notas: 'todo ok' }).subscribe();
    const req = httpMock.expectOne(`${url}/sessions/current`);
    expect(req.request.body).toEqual({ cashCounted: 9000, notes: 'todo ok' });
    req.flush({ id: 'sess1', closedAt: '2026-01-01T20:00:00Z', diferencia: 0 });
  });

  it('checkPendings() issues a GET to /cash/check-pendings', () => {
    service.checkPendings().subscribe((res) => {
      expect(res).toEqual({ pendingBookings: 1, unpaidSales: 2 });
    });
    const req = httpMock.expectOne(`${url}/check-pendings`);
    expect(req.request.method).toBe('GET');
    req.flush({ pendingBookings: 1, unpaidSales: 2 });
  });
});
