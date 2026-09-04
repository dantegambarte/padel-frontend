import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SalesService, SaleDetail, SaleResponse } from './sales.service';
import { environment } from '../../../environments/environment';

describe('SalesService', () => {
  let service: SalesService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/sales`;

  const mockSaleResponse: SaleResponse = {
    id: 's1',
    total: 1500,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockSaleDetail: SaleDetail = {
    id: 's1',
    total: '1500',
    amountCash: '1500',
    amountTransfer: '0',
    customerName: null,
    status: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    items: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(SalesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('create() POSTs the dto with a unique X-Idempotency-Key header', () => {
    service
      .create({ items: [{ productId: 'p1', quantity: 1 }], amountCash: 800, amountTransfer: 0 })
      .subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(true);
    req.flush(mockSaleResponse);
  });

  it('findOne() issues a GET to /sales/:id', () => {
    service.findOne('s1').subscribe();
    const req = httpMock.expectOne(`${url}/s1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSaleDetail);
  });

  it('findOpen() issues a GET to /sales/open', () => {
    service.findOpen().subscribe((res) => expect(res).toEqual([mockSaleDetail]));
    const req = httpMock.expectOne(`${url}/open`);
    expect(req.request.method).toBe('GET');
    req.flush([mockSaleDetail]);
  });

  it('createOpen() POSTs with status "open" and a unique idempotency key', () => {
    service.createOpen('Mesa 3', [{ productId: 'p1', quantity: 2 }]).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      customerName: 'Mesa 3',
      items: [{ productId: 'p1', quantity: 2 }],
      status: 'open',
    });
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(true);
    req.flush(mockSaleResponse);
  });

  it('addItems() PATCHes /sales/:id/add-items with the delta dto', () => {
    service.addItems('s1', { items: [{ productId: 'p2', quantity: 1 }] }).subscribe();
    const req = httpMock.expectOne(`${url}/s1/add-items`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ items: [{ productId: 'p2', quantity: 1 }] });
    req.flush(mockSaleDetail);
  });

  it('pay() POSTs to /sales/:id/pay with a unique idempotency key', () => {
    service.pay('s1', { amountCash: 1500, amountTransfer: 0 }).subscribe();
    const req = httpMock.expectOne(`${url}/s1/pay`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amountCash: 1500, amountTransfer: 0 });
    expect(req.request.headers.has('X-Idempotency-Key')).toBe(true);
    req.flush(mockSaleResponse);
  });
});
