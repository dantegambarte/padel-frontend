import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TeacherReportComponent } from './teacher-report.component';
import { AuthService } from '../../../core/services/auth.service';
import { TeachersService } from '../../../core/services/teachers.service';
import { ToastService } from '../../../core/services/toast.service';
import { Teacher, TeacherReport } from '../../../core/models/teacher.model';

describe('TeacherReportComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let teachersSvcSpy: jasmine.SpyObj<TeachersService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: { role: 'admin' },
    });
    teachersSvcSpy = jasmine.createSpyObj('TeachersService', ['findAll', 'getReport']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);
    teachersSvcSpy.findAll.and.returnValue(of([teacher]));

    await TestBed.configureTestingModule({
    imports: [TeacherReportComponent],
    providers: [
        { provide: TeachersService, useValue: teachersSvcSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads teachers and computes a default monthly date range on init', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.teachers()).toEqual([teacher]);
    expect(component.startDate).toBeTruthy();
    expect(component.endDate).toBeTruthy();
  });

  it('toasts an error when teachers fail to load', () => {
    teachersSvcSpy.findAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    expect(toastServiceSpy.error).toHaveBeenCalled();
  });

  it('canSearch requires teacher and both dates', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.canSearch).toBe(false);
    component.selectedTeacherId = 't1';
    expect(component.canSearch).toBe(true);
  });

  it('search() does nothing when canSearch is false', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectedTeacherId = '';
    fixture.componentInstance.search();
    expect(teachersSvcSpy.getReport).not.toHaveBeenCalled();
  });

  it('search() fetches the report and stores it', () => {
    const report = {
      teacher,
      period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      bookings: [],
      consumptions: [],
      summary: {
        totalBookings: 0,
        totalMinutes: 0,
        totalHours: 0,
        totalAmount: 0,
        totalConsumptions: 0,
        consumptionsTotal: 0,
        grandTotal: 0,
      },
    } as TeacherReport;
    teachersSvcSpy.getReport.and.returnValue(of(report));

    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectedTeacherId = 't1';

    component.search();

    expect(component.report()).toEqual(report);
    expect(component.isLoading()).toBe(false);
  });

  it('toasts an error when the report request fails', () => {
    teachersSvcSpy.getReport.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectedTeacherId = 't1';

    component.search();

    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('fmtHours() formats minutes into "Xh Ymin"', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.fmtHours(90)).toBe('1h 30min');
    expect(fixture.componentInstance.fmtHours(120)).toBe('2h');
  });

  it('fmtDateRange() combines two formatted dates', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.fmtDateRange('2026-01-01', '2026-01-31')).toBe(
      '01/01/2026 al 31/01/2026',
    );
  });

  it('openSettlement()/closeSettlement() toggle the modal', () => {
    const fixture = TestBed.createComponent(TeacherReportComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openSettlement('clases');
    expect(component.showSettlementModal()).toBe(true);
    expect(component.settlementMode()).toBe('clases');
    component.closeSettlement();
    expect(component.showSettlementModal()).toBe(false);
  });
});
