import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PricingShiftsService } from './pricing-shifts.service';
import { PricingShift, CreatePricingShiftDto } from '../models/pricing-shift.model';
import { environment } from '../../../environments/environment';

describe('PricingShiftsService', () => {
  let service: PricingShiftsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/pricing-shifts`;

  const mockShift: PricingShift = {
    id: 's1',
    name: 'Horario pico',
    startTime: '18:00',
    endTime: '23:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    price30min: 1500,
    price60min: 3000,
    price90min: 4500,
    price120min: 6000,
    teacherPricePerHour: 2500,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(PricingShiftsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() never caches — issues a fresh GET /pricing-shifts each call', () => {
    service.getAll().subscribe();
    service.getAll().subscribe();
    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush([mockShift]));
  });

  it('getActive() caches the result across subsequent calls', () => {
    service.getActive().subscribe();
    service.getActive().subscribe();
    const reqs = httpMock.match(`${url}/active`);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockShift]);
  });

  it('clearCache() forces getActive() to hit the server again', () => {
    service.getActive().subscribe();
    httpMock.expectOne(`${url}/active`).flush([mockShift]);

    service.clearCache();

    service.getActive().subscribe();
    const secondReq = httpMock.expectOne(`${url}/active`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush([mockShift]);
  });

  it('create() POSTs the dto and invalidates the active cache', () => {
    service.getActive().subscribe();
    httpMock.expectOne(`${url}/active`).flush([mockShift]);

    const dto: CreatePricingShiftDto = {
      name: 'Nueva franja',
      startTime: '09:00',
      endTime: '18:00',
      daysOfWeek: [0, 6],
      price60min: 2500,
    };
    service.create(dto).subscribe();
    const postReq = httpMock.expectOne(url);
    expect(postReq.request.method).toBe('POST');
    postReq.flush(mockShift);

    service.getActive().subscribe();
    httpMock.expectOne(`${url}/active`).flush([mockShift]);
  });

  it('update() PATCHes /pricing-shifts/:id', () => {
    service.update('s1', { price60min: 3500 }).subscribe();
    const req = httpMock.expectOne(`${url}/s1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ price60min: 3500 });
    req.flush(mockShift);
  });

  it('delete() issues a DELETE to /pricing-shifts/:id', () => {
    service.delete('s1').subscribe();
    const req = httpMock.expectOne(`${url}/s1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
