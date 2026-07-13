import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ToolbarComponent } from './toolbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { BookingsService } from '../../../core/services/bookings.service';
import { CalculatorService } from '../../../core/services/calculator.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SearchService, SearchResponse } from '../../../core/services/search.service';
import { ThemeService } from '../../../core/services/theme.service';
import { HolidayService } from '../../../core/services/holiday.service';
import { AppNotification } from '../../../core/models/notification.model';

describe('ToolbarComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let bookingsServiceSpy: jasmine.SpyObj<BookingsService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let searchServiceSpy: jasmine.SpyObj<SearchService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let notificationsSubject: BehaviorSubject<AppNotification[]>;

  beforeEach(async () => {
    notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout'], { isAdmin: false });
    bookingsServiceSpy = jasmine.createSpyObj('BookingsService', [
      'getPendingExpectedDeposits',
      'confirmExpectedDeposit',
    ]);
    notificationServiceSpy = jasmine.createSpyObj(
      'NotificationService',
      ['removeById', 'clearAllNotifications'],
      { notifications$: notificationsSubject.asObservable() },
    );
    searchServiceSpy = jasmine.createSpyObj('SearchService', ['search']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    bookingsServiceSpy.getPendingExpectedDeposits.and.returnValue(of([]));

    await TestBed.configureTestingModule({
    imports: [ToolbarComponent],
    providers: [
        { provide: CalculatorService, useValue: jasmine.createSpyObj('CalculatorService', ['open']) },
        { provide: ThemeService, useValue: { isDark$: new BehaviorSubject(false), toggle: () => { } } },
        { provide: HolidayService, useValue: { isHoliday$: new BehaviorSubject(false), toggle: () => { } } },
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: SearchService, useValue: searchServiceSpy },
        { provide: BookingsService, useValue: bookingsServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('mirrors notifications from the service', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    const notif = { id: 'n1' } as AppNotification;
    notificationsSubject.next([notif]);
    expect(fixture.componentInstance.notifications).toEqual([notif]);
    expect(fixture.componentInstance.notifCount).toBe(1);
  });

  it('does not load pending deposits for a non-admin user', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    expect(bookingsServiceSpy.getPendingExpectedDeposits).not.toHaveBeenCalled();
  });

  it('debounces search input and queries the SearchService', fakeAsync(() => {
    const results: SearchResponse = { products: [{ id: 'p1', label: 'Pelota' }], bookings: [], sales: [] };
    searchServiceSpy.search.and.returnValue(of(results));
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSearchInput({ target: { value: 'pel' } } as unknown as Event);
    tick(300);

    expect(searchServiceSpy.search).toHaveBeenCalledWith('pel');
    expect(fixture.componentInstance.searchResults).toEqual(results);
    expect(fixture.componentInstance.isSearchOpen).toBe(true);
  }));

  it('clearSearch() resets the query and results', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.searchQuery = 'algo';
    fixture.componentInstance.isSearchOpen = true;

    fixture.componentInstance.clearSearch();

    expect(fixture.componentInstance.searchQuery).toBe('');
    expect(fixture.componentInstance.isSearchOpen).toBe(false);
  });

  it('hasSearchResults is true when any category has results', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.searchResults = {
      products: [],
      bookings: [{ id: 'b1', label: 'Turno' }],
      sales: [],
    };
    expect(fixture.componentInstance.hasSearchResults).toBe(true);
  });

  it('groupedNotifications groups by category with Spanish labels', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    notificationsSubject.next([
      { id: 'n1', category: 'TURNOS' } as AppNotification,
      { id: 'n2', category: 'STOCK' } as AppNotification,
    ]);
    const grouped = fixture.componentInstance.groupedNotifications;
    expect(grouped.find((g) => g.category === 'TURNOS')?.label).toBe('Turnos');
  });

  it('dismissNotification() delegates to the service and stops propagation', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    const event = new MouseEvent('click');
    spyOn(event, 'stopPropagation');
    fixture.componentInstance.dismissNotification('n1', event);
    expect(notificationServiceSpy.removeById).toHaveBeenCalledWith('n1');
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('logout() logs out and navigates to login', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.logout();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('confirmDeposit() removes the deposit from the local list on success', () => {
    bookingsServiceSpy.confirmExpectedDeposit.and.returnValue(of({} as any));
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.pendingDeposits = [{ id: 'd1' } as any];

    fixture.componentInstance.confirmDeposit({ id: 'd1' } as any);

    expect(fixture.componentInstance.pendingDeposits.length).toBe(0);
  });

  it('toggleNotif() closes the search and user menu when opening', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    fixture.componentInstance.isUserMenuOpen = true;
    fixture.componentInstance.toggleNotif();
    expect(fixture.componentInstance.isNotifOpen).toBe(true);
    expect(fixture.componentInstance.isUserMenuOpen).toBe(false);
  });

  it('onDocumentClick() closes every open panel', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.isNotifOpen = true;
    component.isUserMenuOpen = true;
    component.isDepositsOpen = true;
    component.isSearchOpen = true;

    component.onDocumentClick();

    expect(component.isNotifOpen).toBe(false);
    expect(component.isUserMenuOpen).toBe(false);
    expect(component.isDepositsOpen).toBe(false);
    expect(component.isSearchOpen).toBe(false);
  });
});
