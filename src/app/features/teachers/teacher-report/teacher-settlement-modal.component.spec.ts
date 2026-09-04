import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { TeacherSettlementModalComponent } from './teacher-settlement-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { TeachersService } from '../../../core/services/teachers.service';
import { TeacherReport } from '../../../core/models/teacher.model';
import { InternalConsumption } from '../../../core/models/internal-consumption.model';

describe('TeacherSettlementModalComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let consumptionSvcSpy: jasmine.SpyObj<InternalConsumptionService>;
  let teachersSvcSpy: jasmine.SpyObj<TeachersService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const report: TeacherReport = {
    teacher: {
      id: 't1',
      fullName: 'Juan',
      phoneNumber: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    period: { startDate: '2026-01-01', endDate: '2026-01-31' },
    bookings: [
      {
        id: 'b1',
        date: '2026-01-05',
        hour: '10:00',
        durationMinutes: 60,
        courtName: 'Cancha 1',
        hourlyRate: 3000,
        teacherAmount: 3000,
      } as any,
    ],
    consumptions: [],
    summary: {
      totalBookings: 1,
      totalMinutes: 60,
      totalHours: 1,
      totalAmount: 3000,
      totalConsumptions: 0,
      consumptionsTotal: 0,
      grandTotal: 3000,
    },
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: { role: 'admin' },
    });
    consumptionSvcSpy = jasmine.createSpyObj('InternalConsumptionService', ['getAll']);
    teachersSvcSpy = jasmine.createSpyObj('TeachersService', ['liquidate']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    consumptionSvcSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
    imports: [TeacherSettlementModalComponent],
    providers: [
        { provide: InternalConsumptionService, useValue: consumptionSvcSpy },
        { provide: TeachersService, useValue: teachersSvcSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  function createWithInputs(mode: 'clases' | 'completa' = 'completa') {
    const fixture = TestBed.createComponent(TeacherSettlementModalComponent);
    fixture.componentRef.setInput('report', report);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }

  it('mode "clases" skips loading consumptions', () => {
    const fixture = createWithInputs('clases');
    expect(consumptionSvcSpy.getAll).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('mode "completa" loads pending consumptions for the teacher', () => {
    const fixture = createWithInputs('completa');
    expect(consumptionSvcSpy.getAll).toHaveBeenCalledWith({
      teacherId: 't1',
      status: 'pending_payment',
    });
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('grandTotal sums bookingTotal and consumptionTotal', () => {
    const consumption: InternalConsumption = {
      id: 'ic1',
      productId: 'p1',
      product: { id: 'p1', name: 'Gatorade', icon: 'x' },
      quantity: 2,
      consumerType: 'teacher',
      userId: null,
      user: null,
      teacherId: 't1',
      teacher: null,
      status: 'pending_payment',
      notes: null,
      unitCostPrice: 500,
      date: '2026-01-01',
      createdByUserId: null,
      createdAt: '',
      updatedAt: '',
    };
    consumptionSvcSpy.getAll.and.returnValue(of([consumption]));

    const fixture = createWithInputs('completa');

    expect(fixture.componentInstance.consumptionTotal()).toBe(1000);
    expect(fixture.componentInstance.grandTotal()).toBe(4000);
  });

  it('onSettle() emits settled on success', () => {
    teachersSvcSpy.liquidate.and.returnValue(of({ settled: true, totalAmount: 3000 }));
    const fixture = createWithInputs('completa');
    const emitSpy = spyOn(fixture.componentInstance.settled, 'emit');

    fixture.componentInstance.onSettle();

    expect(teachersSvcSpy.liquidate).toHaveBeenCalledWith({
      teacherId: 't1',
      bookingIds: ['b1'],
      consumptionIds: [],
      paymentMethod: 'cash',
    });
    expect(emitSpy).toHaveBeenCalled();
  });

  it('onSettle() offers to navigate to cash-register on CAJA_CERRADA', () => {
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: true } as any));
    teachersSvcSpy.liquidate.and.returnValue(
      throwError(() => ({ error: { errorCode: 'CAJA_CERRADA' } })),
    );
    const fixture = createWithInputs('completa');
    const cancelSpy = spyOn(fixture.componentInstance.cancelled, 'emit');

    fixture.componentInstance.onSettle();

    expect(Swal.fire).toHaveBeenCalled();
    expect(fixture.componentInstance.settling()).toBe(false);
  });

  it('onCancel() emits cancelled', () => {
    const fixture = createWithInputs('completa');
    const emitSpy = spyOn(fixture.componentInstance.cancelled, 'emit');
    fixture.componentInstance.onCancel();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('fmtHours() formats minutes as "Xh Ymin", omitting minutes when zero', () => {
    const fixture = createWithInputs('clases');
    expect(fixture.componentInstance.fmtHours(90)).toBe('1h 30min');
    expect(fixture.componentInstance.fmtHours(120)).toBe('2h');
  });

  it('isEmployeeRole reflects the current user role', () => {
    const fixture = createWithInputs('clases');
    expect(fixture.componentInstance.isEmployeeRole).toBe(false);
  });
});
