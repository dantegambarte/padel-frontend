import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { BookingsService } from '../../core/services/bookings.service';
import { CashService } from '../../core/services/cash.service';
import { ProductsService } from '../../core/services/products.service';

describe('DashboardComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], { isAdmin: false });

    const bookingsServiceSpy = jasmine.createSpyObj('BookingsService', ['findByDate']);
    bookingsServiceSpy.findByDate.and.returnValue(of([]));
    const cashServiceSpy = jasmine.createSpyObj('CashService', ['getCurrent']);
    cashServiceSpy.getCurrent.and.returnValue(of({ efectivoEsperado: 0 } as any));
    const productsServiceSpy = jasmine.createSpyObj('ProductsService', ['getLowStock']);
    productsServiceSpy.getLowStock.and.returnValue(of([]));

    await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: BookingsService, useValue: bookingsServiceSpy },
        { provide: CashService, useValue: cashServiceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('creates and renders without throwing', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('isAdmin reflects AuthService.isAdmin', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    expect(fixture.componentInstance.isAdmin).toBe(false);
  });
});
