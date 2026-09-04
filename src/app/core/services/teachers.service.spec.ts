import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TeachersService } from './teachers.service';
import { Teacher, CreateTeacherDto } from '../models/teacher.model';
import { environment } from '../../../environments/environment';

describe('TeachersService', () => {
  let service: TeachersService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/teachers`;

  const mockTeacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(TeachersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('findAll() defaults to active-only and caches the result', () => {
    service.findAll().subscribe();
    service.findAll().subscribe();
    const reqs = httpMock.match((r) => r.url === url && r.params.keys().length === 0);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockTeacher]);
  });

  it('findAll(true) requests includeInactive and caches separately from the active-only list', () => {
    service.findAll().subscribe();
    httpMock
      .expectOne((r) => r.url === url && r.params.keys().length === 0)
      .flush([mockTeacher]);

    service.findAll(true).subscribe();
    service.findAll(true).subscribe();
    const reqs = httpMock.match(
      (r) => r.url === url && r.params.get('includeInactive') === 'true',
    );
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockTeacher]);
  });

  it('clearCache() invalidates both the active and the all-inclusive cache', () => {
    service.findAll().subscribe();
    httpMock
      .expectOne((r) => r.url === url && r.params.keys().length === 0)
      .flush([mockTeacher]);

    service.clearCache();

    service.findAll().subscribe();
    const secondReq = httpMock.expectOne(
      (r) => r.url === url && r.params.keys().length === 0,
    );
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush([mockTeacher]);
  });

  it('create() POSTs the dto and invalidates the cache', () => {
    const dto: CreateTeacherDto = { fullName: 'Ana' };
    service.create(dto).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockTeacher);
  });

  it('update() PATCHes /teachers/:id', () => {
    service.update('t1', { fullName: 'Juan Actualizado' }).subscribe();
    const req = httpMock.expectOne(`${url}/t1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockTeacher);
  });

  it('deactivate() issues a DELETE to /teachers/:id', () => {
    service.deactivate('t1').subscribe();
    const req = httpMock.expectOne(`${url}/t1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getReport() sends startDate and endDate as query params', () => {
    service.getReport('t1', '2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${url}/t1/report` &&
        r.params.get('startDate') === '2026-01-01' &&
        r.params.get('endDate') === '2026-01-31',
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('liquidate() POSTs to /teachers/liquidate', () => {
    service
      .liquidate({
        teacherId: 't1',
        bookingIds: ['b1'],
        consumptionIds: [],
        paymentMethod: 'cash',
      })
      .subscribe((res) => {
        expect(res).toEqual({ settled: true, totalAmount: 5000 });
      });
    const req = httpMock.expectOne(`${url}/liquidate`);
    expect(req.request.method).toBe('POST');
    req.flush({ settled: true, totalAmount: 5000 });
  });
});
