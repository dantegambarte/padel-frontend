import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardEmployeeComponent } from './dashboard-employee.component';
import { BookingsService } from '../../../core/services/bookings.service';
import { CashService } from '../../../core/services/cash.service';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';

describe('DashboardEmployeeComponent', () => {
  let bookingsServiceSpy: jasmine.SpyObj<BookingsService>;
  let cashServiceSpy: jasmine.SpyObj<CashService>;
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    bookingsServiceSpy = jasmine.createSpyObj('BookingsService', ['findByDate']);
    cashServiceSpy = jasmine.createSpyObj('CashService', ['getCurrent']);
    productsServiceSpy = jasmine.createSpyObj('ProductsService', ['getLowStock']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['error']);

    bookingsServiceSpy.findByDate.and.returnValue(of([]));
    cashServiceSpy.getCurrent.and.returnValue(of({ efectivoEsperado: 5000 } as any));
    productsServiceSpy.getLowStock.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [DashboardEmployeeComponent],
      providers: [
        { provide: BookingsService, useValue: bookingsServiceSpy },
        { provide: CashService, useValue: cashServiceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('loads cash, bookings and low-stock in parallel on init', () => {
    const fixture = TestBed.createComponent(DashboardEmployeeComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoading).toBe(false);
    expect(fixture.componentInstance.cashAmount).toBe(5000);
  });

  it('filters upcoming bookings to booked/playing and sorts by hour', () => {
    const court = { id: 'c1', name: 'Cancha 1', description: '', isActive: true };
    bookingsServiceSpy.findByDate.and.returnValue(
      of([
        { status: 'booked', hour: '15:00', court } as any,
        { status: 'completed', hour: '10:00', court } as any,
        { status: 'playing', hour: '09:00', court } as any,
      ]),
    );
    const fixture = TestBed.createComponent(DashboardEmployeeComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.upcomingBookings.map((b) => b.hour)).toEqual([
      '09:00',
      '15:00',
    ]);
  });

  it('toasts an error when the parallel load fails entirely', () => {
    bookingsServiceSpy.findByDate.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(DashboardEmployeeComponent);
    fixture.detectChanges();

    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('proximoTurnoValue falls back to "Sin turnos" with no upcoming bookings', () => {
    const fixture = TestBed.createComponent(DashboardEmployeeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.proximoTurnoValue).toBe('Sin turnos');
  });

  it('isPaid() is true only when the payment covers the full price', () => {
    const fixture = TestBed.createComponent(DashboardEmployeeComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(
      component.isPaid({
        payment: { amountCash: 3000, amountTransfer: 0 },
        priceAmount: 3000,
      } as any),
    ).toBe(true);

    expect(
      component.isPaid({
        payment: { amountCash: 1000, amountTransfer: 0 },
        priceAmount: 3000,
      } as any),
    ).toBe(false);

    expect(component.isPaid({ payment: null, priceAmount: 3000 } as any)).toBe(false);
  });
});
