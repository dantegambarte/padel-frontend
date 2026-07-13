import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReportsComponent } from './reports.component';
import { ReportsService, TransactionExport } from '../../core/services/reports.service';
import { ProductsService } from '../../core/services/products.service';
import { CashService } from '../../core/services/cash.service';
import { ToastService } from '../../core/services/toast.service';
import { BookingsService } from '../../core/services/bookings.service';

describe('ReportsComponent', () => {
  let reportsServiceSpy: jasmine.SpyObj<ReportsService>;
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let cashServiceSpy: jasmine.SpyObj<CashService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let bookingsServiceSpy: jasmine.SpyObj<BookingsService>;

  function setup() {
    reportsServiceSpy = jasmine.createSpyObj('ReportsService', [
      'getRevenue',
      'getPaymentMethods',
      'getSummary',
      'getProductsRanking',
      'getTransactionsExport',
      'getExpenses',
    ]);
    productsServiceSpy = jasmine.createSpyObj('ProductsService', ['getLowStock']);
    cashServiceSpy = jasmine.createSpyObj('CashService', ['getCurrent']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    bookingsServiceSpy = jasmine.createSpyObj('BookingsService', ['getTicketSummary']);

    reportsServiceSpy.getRevenue.and.returnValue(
      of([{ period: '01/01', bookings: 1000, sales: 500, total: 1500, expenses: 100 }]),
    );
    reportsServiceSpy.getPaymentMethods.and.returnValue(
      of({ cash: { total: 800, percentage: 60 }, transfer: { total: 700, percentage: 40 }, grandTotal: 1500 }),
    );
    reportsServiceSpy.getSummary.and.returnValue(of({} as any));
    productsServiceSpy.getLowStock.and.returnValue(of([]));
    cashServiceSpy.getCurrent.and.returnValue(
      of({ sessionId: 's1', isClosed: false, sessionDate: '2026-01-01', openedAt: '2026-01-01T09:00:00Z' } as any),
    );

    TestBed.configureTestingModule({
    imports: [ReportsComponent],
    providers: [
        { provide: ReportsService, useValue: reportsServiceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: CashService, useValue: cashServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: BookingsService, useValue: bookingsServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('defaults to the "mes" preset and loads KPIs for tab 0 on init', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.selectedPreset).toBe('mes');
    expect(reportsServiceSpy.getRevenue).toHaveBeenCalled();
    expect(component.revenueData.length).toBe(1);
  });

  it('loads the cash session banner state on init', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.cashSession?.sessionId).toBe('s1');
    expect(fixture.componentInstance.cashSessionLoading).toBe(false);
  });

  it('totalRevenue/totalAlquileres/totalProductos derive from revenueData', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.totalRevenue).toBe(1500);
    expect(component.totalAlquileres).toBe(1000);
    expect(component.totalProductos).toBe(500);
    expect(component.pctAlquileres).toBe('66.7');
  });

  it('onTabChange() lazily loads ranking data only once for tab 2', () => {
    setup();
    reportsServiceSpy.getProductsRanking.and.returnValue(of([]));
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    fixture.componentInstance.onTabChange(2);
    fixture.componentInstance.onTabChange(0);
    fixture.componentInstance.onTabChange(2);

    expect(reportsServiceSpy.getProductsRanking).toHaveBeenCalledTimes(1);
  });

  it('onTabChange() does nothing when re-selecting the already-active tab', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const initialCalls = reportsServiceSpy.getRevenue.calls.count();

    fixture.componentInstance.onTabChange(0);

    expect(reportsServiceSpy.getRevenue.calls.count()).toBe(initialCalls);
  });

  it('applyFilters() rejects an incomplete date range', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.dateFrom = '';

    fixture.componentInstance.applyFilters();

    expect(toastServiceSpy.error).toHaveBeenCalledWith(
      'Fechas incompletas',
      jasmine.any(String),
    );
  });

  it('applyFilters() rejects a reversed date range', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.dateFrom = '2026-02-01';
    fixture.componentInstance.dateTo = '2026-01-01';

    fixture.componentInstance.applyFilters();

    expect(toastServiceSpy.error).toHaveBeenCalledWith('Rango inválido', jasmine.any(String));
  });

  it('applyFilters() invalidates caches and reloads the active tab', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    reportsServiceSpy.getRevenue.calls.reset();

    fixture.componentInstance.applyFilters();

    expect(reportsServiceSpy.getRevenue).toHaveBeenCalled();
  });

  it('setPreset() debounces the HTTP call by 400ms', fakeAsync(() => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    reportsServiceSpy.getRevenue.calls.reset();

    fixture.componentInstance.setPreset('semana');
    expect(reportsServiceSpy.getRevenue).not.toHaveBeenCalled();

    tick(400);
    expect(reportsServiceSpy.getRevenue).toHaveBeenCalled();
    expect(fixture.componentInstance.selectedPreset).toBe('semana');
  }));

  it('selectToday() applies the filter immediately, bypassing debounce', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    reportsServiceSpy.getRevenue.calls.reset();

    fixture.componentInstance.selectToday();

    expect(fixture.componentInstance.selectedPreset).toBe('hoy');
    expect(fixture.componentInstance.dateFrom).toBe(fixture.componentInstance.dateTo);
    expect(reportsServiceSpy.getRevenue).toHaveBeenCalled();
  });

  it('onDateChanged() clears the highlighted preset', fakeAsync(() => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.onDateChanged();
    expect(fixture.componentInstance.selectedPreset).toBe('');
    tick(400);
  }));

  it('filteredTransactions applies type and payment-method filters', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.transactions = [
      { date: '', time: '', type: 'booking', concept: '', cash: 1000, transfer: 0, total: 1000, createdBy: '', referenceId: null },
      { date: '', time: '', type: 'sale', concept: '', cash: 0, transfer: 500, total: 500, createdBy: '', referenceId: null },
    ] as TransactionExport[];

    component.txFilterType = 'sale';
    expect(component.filteredTransactions.length).toBe(1);

    component.txFilterType = 'all';
    component.txFilterPayment = 'transfer';
    expect(component.filteredTransactions.map((t) => t.type)).toEqual(['sale']);
  });

  it('openTicket() for a sale sets ticketSaleId without an HTTP call', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openTicket('sale-1', 'sale');
    expect(fixture.componentInstance.ticketSaleId).toBe('sale-1');
    expect(bookingsServiceSpy.getTicketSummary).not.toHaveBeenCalled();
  });

  it('openTicket() for a booking fetches the ticket summary', () => {
    setup();
    bookingsServiceSpy.getTicketSummary.and.returnValue(
      of({
        booking: {
          items: [],
          court: { name: 'Cancha 1' },
          hour: '10:00',
          durationMinutes: 60,
          clientName: 'Juan',
          priceAmount: 3000,
          payment: null,
        } as any,
        transactions: [],
      }),
    );
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    fixture.componentInstance.openTicket('b1', 'booking');

    expect(bookingsServiceSpy.getTicketSummary).toHaveBeenCalledWith('b1');
    expect(fixture.componentInstance.isLoadingTicket).toBe(false);
  });

  it('openTicket() for a booking toasts on error', () => {
    setup();
    bookingsServiceSpy.getTicketSummary.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    fixture.componentInstance.openTicket('b1', 'booking');

    expect(toastServiceSpy.error).toHaveBeenCalled();
  });

  it('closeTicket() clears ticketSaleId', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.ticketSaleId = 'sale-1';
    fixture.componentInstance.closeTicket();
    expect(fixture.componentInstance.ticketSaleId).toBeNull();
  });

  it('exportCSV() toasts an error when there is no data to export', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.transactions = [];

    fixture.componentInstance.exportCSV();

    expect(toastServiceSpy.error).toHaveBeenCalledWith('Sin datos', jasmine.any(String));
  });

  it('exportCSV() triggers a download and success toast when data exists', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.transactions = [
      { date: '2026-01-01', time: '10:00', type: 'booking', concept: 'Turno', cash: 1000, transfer: 0, total: 1000, createdBy: 'Admin', referenceId: null },
    ];
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    fixture.componentInstance.exportCSV();

    expect(clickSpy).toHaveBeenCalled();
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('exportExcel() fetches fresh data when the cache is empty', () => {
    setup();
    reportsServiceSpy.getTransactionsExport.and.returnValue(
      of([
        { date: '2026-01-01', time: '10:00', type: 'sale', concept: 'Venta', cash: 500, transfer: 0, total: 500, createdBy: 'Admin', referenceId: null },
      ]),
    );
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.transactions = [];

    fixture.componentInstance.exportExcel();

    expect(reportsServiceSpy.getTransactionsExport).toHaveBeenCalled();
    expect(fixture.componentInstance.isExporting).toBe(false);
  });

  it('resetTxFilters() sets both filters back to "all"', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    fixture.componentInstance.txFilterType = 'sale';
    fixture.componentInstance.txFilterPayment = 'cash';
    fixture.componentInstance.resetTxFilters();
    expect(fixture.componentInstance.txFilterType).toBe('all');
    expect(fixture.componentInstance.txFilterPayment).toBe('all');
  });

  it('fmt() and fmtCurrency() are null-safe', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.fmt(null)).toBe('0');
    expect(fixture.componentInstance.fmtCurrency(undefined)).toContain('0,00');
  });

  it('expenseCategoryClass() falls back to a default class', () => {
    setup();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.expenseCategoryClass('Insumos')).toContain('blue');
    expect(fixture.componentInstance.expenseCategoryClass('???')).toContain('bg-secondary');
  });
});
