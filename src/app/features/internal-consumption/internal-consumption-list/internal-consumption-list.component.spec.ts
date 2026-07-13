import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAR from '@angular/common/locales/es-AR';
import { of, throwError } from 'rxjs';
import { InternalConsumptionListComponent } from './internal-consumption-list.component';

registerLocaleData(localeEsAR);
import { AuthService } from '../../../core/services/auth.service';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { TeachersService } from '../../../core/services/teachers.service';
import { Teacher } from '../../../core/models/teacher.model';
import { InternalConsumption, TeacherDebtSummary } from '../../../core/models/internal-consumption.model';

describe('InternalConsumptionListComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let serviceSpy: jasmine.SpyObj<InternalConsumptionService>;
  let teachersServiceSpy: jasmine.SpyObj<TeachersService>;

  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: '+5491100000000',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const summary: TeacherDebtSummary = { teacherId: 't1', totalItems: 1, totalCost: 800 };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: { role: 'admin' },
    });
    serviceSpy = jasmine.createSpyObj('InternalConsumptionService', [
      'getAll',
      'getTeacherDebtSummary',
      'buildItemizedWhatsAppUrl',
    ]);
    teachersServiceSpy = jasmine.createSpyObj('TeachersService', ['findAll']);

    serviceSpy.getAll.and.returnValue(of([]));
    serviceSpy.getTeacherDebtSummary.and.returnValue(of([summary]));
    teachersServiceSpy.findAll.and.returnValue(of([teacher]));

    await TestBed.configureTestingModule({
    imports: [InternalConsumptionListComponent],
    providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: InternalConsumptionService, useValue: serviceSpy },
        { provide: TeachersService, useValue: teachersServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads consumptions, debt summary and teachers in parallel, enriching the summary', () => {
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.loading).toBe(false);
    expect(component.teachers).toEqual([teacher]);
    expect(component.debtSummary[0].teacherName).toBe('Juan');
    expect(component.debtSummary[0].phoneNumber).toBe('+5491100000000');
  });

  it('sets an error message when the parallel load fails', () => {
    serviceSpy.getAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.error).toContain('No se pudieron cargar');
  });

  it('openSettleModal() sets settleTarget when the teacher is found', () => {
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();
    fixture.componentInstance.openSettleModal(fixture.componentInstance.debtSummary[0]);
    expect(fixture.componentInstance.settleTarget?.teacher.id).toBe('t1');
  });

  it('onSettled() clears settleTarget and reloads', () => {
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();
    fixture.componentInstance.settleTarget = {
      teacher,
      summary: { ...summary, teacherName: teacher.fullName, phoneNumber: teacher.phoneNumber },
    };
    fixture.componentInstance.onSettled();
    expect(fixture.componentInstance.settleTarget).toBeNull();
  });

  it('notifyTeacher() opens WhatsApp with an itemized message when the teacher has a phone', () => {
    serviceSpy.buildItemizedWhatsAppUrl.and.returnValue('https://wa.me/5491100000000');
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();

    const consumption: InternalConsumption = {
      id: 'ic1',
      productId: 'p1',
      product: { id: 'p1', name: 'Gatorade', icon: 'inventory_2' },
      quantity: 2,
      consumerType: 'teacher',
      userId: null,
      user: null,
      teacherId: 't1',
      teacher,
      status: 'pending_payment',
      notes: null,
      unitCostPrice: 800,
      date: '2026-01-01',
      createdByUserId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    fixture.componentInstance.notifyTeacher(consumption);

    expect(serviceSpy.buildItemizedWhatsAppUrl).toHaveBeenCalled();
    expect(windowOpenSpy).toHaveBeenCalled();
  });

  it('clearFilters() resets filters and reloads', () => {
    const fixture = TestBed.createComponent(InternalConsumptionListComponent);
    fixture.detectChanges();
    fixture.componentInstance.filters = { status: 'paid' };
    fixture.componentInstance.clearFilters();
    expect(fixture.componentInstance.filters).toEqual({});
  });
});
