import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardAdminComponent } from './dashboard-admin.component';
import { ReportsService, TodayKpis, DailyRevenue } from '../../../core/services/reports.service';
import { ToastService } from '../../../core/services/toast.service';

describe('DashboardAdminComponent', () => {
  let reportsServiceSpy: jasmine.SpyObj<ReportsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  const mockKpis = { totalRevenue: 10000 } as TodayKpis;
  const mockRevenue: DailyRevenue[] = [
    { date: '2026-01-01', cash: 1000, transfer: 500, total: 1500 },
    { date: '2026-01-02', cash: 2000, transfer: 300, total: 2300 },
  ];

  beforeEach(async () => {
    reportsServiceSpy = jasmine.createSpyObj('ReportsService', [
      'getTodayKpis',
      'getLast7DaysRevenue',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['error']);
    reportsServiceSpy.getTodayKpis.and.returnValue(of(mockKpis));
    reportsServiceSpy.getLast7DaysRevenue.and.returnValue(of(mockRevenue));

    await TestBed.configureTestingModule({
    imports: [DashboardAdminComponent],
    providers: [
        { provide: ReportsService, useValue: reportsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads kpis and builds the revenue chart on init', () => {
    const fixture = TestBed.createComponent(DashboardAdminComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.isLoading()).toBe(false);
    expect(component.kpis()).toEqual(mockKpis);
    expect(component.barChartData().labels).toEqual(['01/01', '02/01']);
    expect(component.barChartData().datasets[0].data).toEqual([1000, 2000]);
    expect(component.barChartData().datasets[1].data).toEqual([500, 300]);
  });

  it('toasts an error when the parallel load fails', () => {
    reportsServiceSpy.getTodayKpis.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(DashboardAdminComponent);
    fixture.detectChanges();

    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('fmt() defaults to 0 for null/undefined', () => {
    const fixture = TestBed.createComponent(DashboardAdminComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.fmt(null)).toBe('0');
    expect(fixture.componentInstance.fmt(undefined)).toBe('0');
    expect(fixture.componentInstance.fmt(1500)).toBe((1500).toLocaleString('es-AR'));
  });
});
