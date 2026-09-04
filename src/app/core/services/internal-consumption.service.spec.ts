import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { InternalConsumptionService } from './internal-consumption.service';
import {
  InternalConsumption,
  CreateInternalConsumptionDto,
  TeacherDebtSummary,
} from '../models/internal-consumption.model';
import { environment } from '../../../environments/environment';

describe('InternalConsumptionService', () => {
  let service: InternalConsumptionService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/internal-consumption`;

  const mockConsumption: InternalConsumption = {
    id: 'ic1',
    productId: 'p1',
    product: { id: 'p1', name: 'Gatorade', icon: 'inventory_2' },
    quantity: 2,
    consumerType: 'teacher',
    userId: null,
    user: null,
    teacherId: 't1',
    teacher: { id: 't1', fullName: 'Juan', phoneNumber: '+5491100000000' },
    status: 'pending_payment',
    notes: null,
    unitCostPrice: 500,
    date: '2026-01-01',
    createdByUserId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(InternalConsumptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() without filters sends no query params', () => {
    service.getAll().subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.params.keys().length).toBe(0);
    req.flush([mockConsumption]);
  });

  it('getAll() forwards every provided filter as a query param', () => {
    service
      .getAll({
        status: 'pending_payment',
        consumerType: 'teacher',
        teacherId: 't1',
        userId: 'u1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      })
      .subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === url &&
        r.params.get('status') === 'pending_payment' &&
        r.params.get('consumerType') === 'teacher' &&
        r.params.get('teacherId') === 't1' &&
        r.params.get('userId') === 'u1' &&
        r.params.get('dateFrom') === '2026-01-01' &&
        r.params.get('dateTo') === '2026-01-31',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockConsumption]);
  });

  it('getOne() issues a GET to /internal-consumption/:id', () => {
    service.getOne('ic1').subscribe();
    const req = httpMock.expectOne(`${url}/ic1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockConsumption);
  });

  it('create() POSTs the dto', () => {
    const dto: CreateInternalConsumptionDto = {
      productId: 'p1',
      quantity: 2,
      consumerType: 'teacher',
      teacherId: 't1',
      date: '2026-01-01',
    };
    service.create(dto).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockConsumption);
  });

  it('settleTeacherDebt() PATCHes /internal-consumption/settle', () => {
    service
      .settleTeacherDebt({ teacherId: 't1', paymentMethod: 'cash' })
      .subscribe();
    const req = httpMock.expectOne(`${url}/settle`);
    expect(req.request.method).toBe('PATCH');
    req.flush([mockConsumption]);
  });

  it('getTeacherDebtSummary() issues a GET to /internal-consumption/teacher-debt-summary', () => {
    const summary: TeacherDebtSummary[] = [
      { teacherId: 't1', totalItems: 3, totalCost: 1500 },
    ];
    service.getTeacherDebtSummary().subscribe((res) => {
      expect(res).toEqual(summary);
    });
    const req = httpMock.expectOne(`${url}/teacher-debt-summary`);
    req.flush(summary);
  });

  describe('buildItemizedWhatsAppUrl()', () => {
    it('strips non-digit characters from the phone number', () => {
      const result = service.buildItemizedWhatsAppUrl(
        '+54 9 11 0000-0000',
        'Juan',
        [{ name: 'Gatorade', quantity: 1, subtotal: 800 }],
        800,
      );
      expect(result).toMatch(/^https:\/\/wa\.me\/5491100000000\?text=/);
    });

    it('URL-encodes the message and includes the teacher name and items', () => {
      const result = service.buildItemizedWhatsAppUrl(
        '1122334455',
        'María',
        [{ name: 'Gatorade', quantity: 2, subtotal: 1600 }],
        1600,
      );
      const decoded = decodeURIComponent(result.split('?text=')[1]);
      expect(decoded).toContain('María');
      expect(decoded).toContain('Gatorade');
      expect(decoded).toContain('2x');
    });
  });

  describe('buildDebtReminderWhatsAppUrl()', () => {
    it('builds a wa.me URL with the teacher name and formatted total debt', () => {
      const result = service.buildDebtReminderWhatsAppUrl(
        '1122334455',
        'María',
        1600,
      );
      expect(result).toMatch(/^https:\/\/wa\.me\/1122334455\?text=/);
      const decoded = decodeURIComponent(result.split('?text=')[1]);
      expect(decoded).toContain('María');
    });
  });
});
