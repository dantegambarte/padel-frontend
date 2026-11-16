import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { TestBed } from '@angular/core/testing';
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
      provideCharts(withDefaultRegisterables()),
        { provide: ReportsService, useValue: reportsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
    ],
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

  it('renders the revenue summary once loaded and the empty-revenue message for zero revenue', () => {
    const fixture = TestBed.createComponent(DashboardAdminComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Total Recaudado');
    expect(el.textContent).not.toContain('Sin ingresos registrados hoy');

    fixture.componentInstance.kpis.set({ ...mockKpis, totalRevenue: 0 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Sin ingresos registrados hoy');
  });

  it('renders loading skeletons while loading', () => {
    const fixture = TestBed.createComponent(DashboardAdminComponent);
    fixture.detectChanges();
    fixture.componentInstance.isLoading.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(el.textContent).not.toContain('Total Recaudado');
  });
});
