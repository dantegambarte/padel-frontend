import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { BookingsService } from './bookings.service';
import { BookingResponse } from '../models/booking.model';
import { environment } from '../../../environments/environment';

function makeBooking(overrides: Partial<BookingResponse> = {}): BookingResponse {
  return {
    id: 'b1',
    court: { id: 'c1', name: 'Cancha 1', description: '', isActive: true },
    courtId: 'c1',
    date: '2026-01-01',
    hour: '10:00',
    clientName: 'Juan',
    status: 'booked',
    priceType: 'standard',
    appliedShiftName: null,
    priceAmount: 3000,
    durationMinutes: 60,
    items: [],
    payment: null,
    createdAt: '2026-01-01T00:00:00Z',
    fixedBookingId: null,
    fixedBooking: null,
    isConfirmed: false,
    expectedDepositAmount: null,
    playerCount: null,
    teacherRateSnapshot: null,
    ...overrides,
  };
}

describe('BookingsService', () => {
  let service: BookingsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/bookings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(BookingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('findByDate() sends the date as a query param', () => {
    service.findByDate('2026-01-01').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === url && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush([makeBooking()]);
  });

  it('create() POSTs the dto with a unique X-Idempotency-Key header', () => {
    service.create({ courtId: 'c1', date: '2026-01-01', hour: '10:00' }).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(true);
    expect(req.request.headers.get('X-Idempotency-Key')!.length).toBeGreaterThan(0);
    req.flush(makeBooking());
  });

  it('two create() calls use different idempotency keys', () => {
    service.create({ courtId: 'c1', date: '2026-01-01', hour: '10:00' }).subscribe();
    service.create({ courtId: 'c1', date: '2026-01-01', hour: '11:00' }).subscribe();
    const [req1, req2] = httpMock.match(url);
    expect(req1.request.headers.get('X-Idempotency-Key')).not.toBe(
      req2.request.headers.get('X-Idempotency-Key'),
    );
    req1.flush(makeBooking());
    req2.flush(makeBooking());
  });

  it('updateStatus() PATCHes /bookings/:id with the status dto', () => {
    service.updateStatus('b1', { status: 'playing' }).subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'playing' });
    req.flush(makeBooking({ status: 'playing' }));
  });

  it('update() PATCHes /bookings/:id with the partial dto', () => {
    service.update('b1', { clientName: 'Nuevo' }).subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(makeBooking());
  });

  it('findOne() issues a GET to /bookings/:id', () => {
    service.findOne('b1').subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.method).toBe('GET');
    req.flush(makeBooking());
  });

  it('cancel() issues a DELETE to /bookings/:id', () => {
    service.cancel('b1').subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('move() PATCHes /bookings/:id with the destination slot', () => {
    service.move('b1', { courtId: 'c2', date: '2026-01-02', hour: '11:00' }).subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      courtId: 'c2',
      date: '2026-01-02',
      hour: '11:00',
    });
    req.flush(makeBooking());
  });

  it('duplicate() POSTs with sourceId merged into the destination slot', () => {
    service.duplicate('b1', { courtId: 'c2', date: '2026-01-02', hour: '11:00' }).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      courtId: 'c2',
      date: '2026-01-02',
      hour: '11:00',
      sourceId: 'b1',
    });
    req.flush(makeBooking());
  });

  it('confirm() PATCHes isConfirmed: true', () => {
    service.confirm('b1').subscribe();
    const req = httpMock.expectOne(`${url}/b1`);
    expect(req.request.body).toEqual({ isConfirmed: true });
    req.flush(makeBooking({ isConfirmed: true }));
  });

  it('confirmExpectedDeposit() POSTs and emits on bookingUpdated$', (done) => {
    const updated = makeBooking({ expectedDepositAmount: null });
    service.bookingUpdated$.subscribe((b) => {
      expect(b).toEqual(updated);
      done();
    });
    service.confirmExpectedDeposit('b1').subscribe();
    const req = httpMock.expectOne(`${url}/b1/confirm-expected-deposit`);
    expect(req.request.method).toBe('POST');
    req.flush(updated);
  });

  it('getPendingExpectedDeposits() issues a GET to the pending-expected-deposits endpoint', () => {
    service.getPendingExpectedDeposits().subscribe();
    const req = httpMock.expectOne(`${url}/pending-expected-deposits`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getTicketSummary() caches the result per booking id', () => {
    service.getTicketSummary('b1').subscribe();
    service.getTicketSummary('b1').subscribe();
    const reqs = httpMock.match(`${url}/b1/ticket-summary`);
    expect(reqs.length).toBe(1);
    reqs[0].flush({ booking: makeBooking(), transactions: [] });
  });

  it('getTicketSummary() issues separate requests for different ids', () => {
    service.getTicketSummary('b1').subscribe();
    service.getTicketSummary('b2').subscribe();
    const req1 = httpMock.expectOne(`${url}/b1/ticket-summary`);
    const req2 = httpMock.expectOne(`${url}/b2/ticket-summary`);
    expect(req1.request.method).toBe('GET');
    expect(req2.request.method).toBe('GET');
    req1.flush({ booking: makeBooking(), transactions: [] });
    req2.flush({ booking: makeBooking({ id: 'b2' }), transactions: [] });
  });

  it('clearTicketCache() forces a fresh GET for a previously cached id', () => {
    service.getTicketSummary('b1').subscribe();
    httpMock
      .expectOne(`${url}/b1/ticket-summary`)
      .flush({ booking: makeBooking(), transactions: [] });

    service.clearTicketCache();

    service.getTicketSummary('b1').subscribe();
    const secondReq = httpMock.expectOne(`${url}/b1/ticket-summary`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush({ booking: makeBooking(), transactions: [] });
  });
});
