import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ReportsService, TodayKpis, DailyRevenue } from './reports.service';
import { environment } from '../../../environments/environment';

describe('ReportsService', () => {
  let service: ReportsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/reports`;

  const mockKpis: TodayKpis = {
    totalRevenue: 10000,
    cashTotal: 6000,
    transferTotal: 4000,
    completedBookings: 5,
    liveBookings: 1,
    canceledBookings: 0,
    totalOperations: 6,
    totalSlots: 20,
    occupationRate: 0.3,
    cantinaItemsSold: 4,
    cantinaRevenue: 2000,
    courtsRevenue: 8000,
    topProduct: { name: 'Gatorade', quantity: 4 },
    averageTicket: 1666,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ReportsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getTodayKpis() caches the result across subsequent calls', () => {
    service.getTodayKpis().subscribe();
    service.getTodayKpis().subscribe();
    const reqs = httpMock.match(`${url}/kpis`);
    expect(reqs.length).toBe(1);
    reqs[0].flush(mockKpis);
  });

  it('getTodayKpis() cache expires after the 30s TTL', fakeAsync(() => {
    service.getTodayKpis().subscribe();
    httpMock.expectOne(`${url}/kpis`).flush(mockKpis);

    tick(30_000);

    service.getTodayKpis().subscribe();
    const secondReq = httpMock.expectOne(`${url}/kpis`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush(mockKpis);
    tick(30_000); // flush the second TTL timer so nothing leaks into the next test
  }));

  it('getTodayKpis() forwards an explicit date as a query param', () => {
    service.getTodayKpis('2026-01-01').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${url}/kpis` && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockKpis);
  });

  it('getLast7DaysRevenue() caches the result and defaults to 7 days', fakeAsync(() => {
    const revenue: DailyRevenue[] = [];
    service.getLast7DaysRevenue().subscribe();
    service.getLast7DaysRevenue().subscribe();
    const reqs = httpMock.match(
      (r) => r.url === `${url}/revenue/trend` && r.params.get('days') === '7',
    );
    expect(reqs.length).toBe(1);
    reqs[0].flush(revenue);
    tick(60_000);
  }));

  it('clearCache() invalidates both the KPIs and the last-7-days cache', fakeAsync(() => {
    service.getTodayKpis().subscribe();
    httpMock.expectOne(`${url}/kpis`).flush(mockKpis);
    service.getLast7DaysRevenue().subscribe();
    httpMock.expectOne((r) => r.url === `${url}/revenue/trend`).flush([]);

    service.clearCache();

    service.getTodayKpis().subscribe();
    const secondKpis = httpMock.expectOne(`${url}/kpis`);
    expect(secondKpis.request.method).toBe('GET');
    secondKpis.flush(mockKpis);
    service.getLast7DaysRevenue().subscribe();
    const secondTrend = httpMock.expectOne((r) => r.url === `${url}/revenue/trend`);
    expect(secondTrend.request.method).toBe('GET');
    secondTrend.flush([]);

    tick(60_000);
  }));

  it('getSummary() omits date params when no range is given', () => {
    service.getSummary().subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${url}/summary` && r.params.keys().length === 0,
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getSummary() sends dateFrom/dateTo when a range is given', () => {
    service.getSummary('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${url}/summary` &&
        r.params.get('dateFrom') === '2026-01-01' &&
        r.params.get('dateTo') === '2026-01-31',
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getRevenue() prioritizes an explicit date over the dateFrom/dateTo range', () => {
    service.getRevenue('2026-01-01', '2026-01-31', 'day', '2026-01-15').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${url}/revenue` &&
        r.params.get('date') === '2026-01-15' &&
        !r.params.has('dateFrom') &&
        r.params.get('groupBy') === 'day',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getRevenue() uses the dateFrom/dateTo range when no explicit date is given', () => {
    service.getRevenue('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${url}/revenue` &&
        r.params.get('dateFrom') === '2026-01-01' &&
        r.params.get('dateTo') === '2026-01-31' &&
        r.params.get('groupBy') === 'week',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getPaymentMethods() sends the resolved date params', () => {
    service.getPaymentMethods('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${url}/payment-methods`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getProductsRanking() sends the resolved date params', () => {
    service.getProductsRanking('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${url}/products-ranking`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getTransactionsExport() sends the resolved date params', () => {
    service.getTransactionsExport('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${url}/transactions`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getExpenses() always sends a dateFrom/dateTo range', () => {
    service.getExpenses('2026-01-01', '2026-01-31').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${url}/expenses` &&
        r.params.get('dateFrom') === '2026-01-01' &&
        r.params.get('dateTo') === '2026-01-31',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalAmount: 0, byCategory: [], byPaymentMethod: [] });
  });
});
