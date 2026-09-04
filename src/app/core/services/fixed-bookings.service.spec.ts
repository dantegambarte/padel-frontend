import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  FixedBookingsService,
  FixedBooking,
  CreateFixedBookingDto,
} from './fixed-bookings.service';
import { environment } from '../../../environments/environment';

describe('FixedBookingsService', () => {
  let service: FixedBookingsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/fixed-bookings`;

  const mockFixed: FixedBooking = {
    id: 'fb1',
    clientName: 'Juan',
    phoneNumber: null,
    dayOfWeek: 1,
    hour: '10:00',
    durationMinutes: 60,
    courtId: 'c1',
    court: { id: 'c1', name: 'Cancha 1', isActive: true },
    isActive: true,
    startDate: '2026-01-01',
    notes: null,
    teacherId: null,
    teacher: null,
    recurringDepositAmount: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(FixedBookingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('findAll() caches the result across subsequent calls', () => {
    service.findAll().subscribe();
    service.findAll().subscribe();
    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockFixed]);
  });

  it('findOne() always issues a fresh GET (no caching)', () => {
    service.findOne('fb1').subscribe();
    service.findOne('fb1').subscribe();
    const reqs = httpMock.match(`${url}/fb1`);
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush(mockFixed));
  });

  it('create() POSTs the dto and invalidates the findAll cache', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockFixed]);

    const dto: CreateFixedBookingDto = {
      clientName: 'Ana',
      dayOfWeek: 2,
      hour: '11:00',
      courtId: 'c1',
      startDate: '2026-01-01',
    };
    service.create(dto).subscribe();
    const postReq = httpMock.expectOne(url);
    expect(postReq.request.method).toBe('POST');
    postReq.flush(mockFixed);

    // Cache invalidated -> a new findAll() hits the server again.
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockFixed]);
  });

  it('update() PATCHes /fixed-bookings/:id and invalidates the cache', () => {
    service.update('fb1', { hour: '12:00' }).subscribe();
    const req = httpMock.expectOne(`${url}/fb1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockFixed);
  });

  it('deactivate() issues a DELETE and invalidates the cache', () => {
    service.deactivate('fb1').subscribe();
    const req = httpMock.expectOne(`${url}/fb1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('deleteFixedBookingCascade() DELETEs /fixed-bookings/:id/cascade', () => {
    service.deleteFixedBookingCascade('fb1').subscribe((res) => {
      expect(res).toEqual({ deleted: 3, preserved: 1 });
    });
    const req = httpMock.expectOne(`${url}/fb1/cascade`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: 3, preserved: 1 });
  });

  it('generateNext() POSTs to /fixed-bookings/:id/generate', () => {
    service.generateNext('fb1').subscribe((res) => {
      expect(res).toEqual({ generated: 5 });
    });
    const req = httpMock.expectOne(`${url}/fb1/generate`);
    expect(req.request.method).toBe('POST');
    req.flush({ generated: 5 });
  });
});
