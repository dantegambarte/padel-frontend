import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ExpensesService } from './expenses.service';
import { Expense, CreateExpenseDto } from '../models/expense.model';
import { environment } from '../../../environments/environment';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/expenses`;

  const mockExpense: Expense = {
    id: 'e1',
    amount: 5000,
    description: 'Pelotas',
    category: 'Insumos',
    paymentMethod: 'Efectivo',
    date: '2026-01-01',
    cashSessionId: null,
    createdByUserId: 'u1',
    createdByUser: { id: 'u1', fullName: 'Admin', role: 'admin' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ExpensesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() without filters issues a plain GET', () => {
    service.getAll().subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([mockExpense]);
  });

  it('getAll() with filters sends them as query params', () => {
    service.getAll({ from: '2026-01-01', to: '2026-01-31' }).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === url &&
        r.params.get('from') === '2026-01-01' &&
        r.params.get('to') === '2026-01-31',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockExpense]);
  });

  it('getOne() issues a GET to /expenses/:id', () => {
    service.getOne('e1').subscribe();
    const req = httpMock.expectOne(`${url}/e1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockExpense);
  });

  it('create() POSTs the dto', () => {
    const dto: CreateExpenseDto = {
      amount: 5000,
      description: 'Pelotas',
      category: 'Insumos',
      paymentMethod: 'Efectivo',
      date: '2026-01-01',
    };
    service.create(dto).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockExpense);
  });

  it('update() PATCHes /expenses/:id with the partial dto', () => {
    service.update('e1', { amount: 6000 }).subscribe();
    const req = httpMock.expectOne(`${url}/e1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ amount: 6000 });
    req.flush(mockExpense);
  });

  it('delete() issues a DELETE to /expenses/:id', () => {
    service.delete('e1').subscribe();
    const req = httpMock.expectOne(`${url}/e1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
