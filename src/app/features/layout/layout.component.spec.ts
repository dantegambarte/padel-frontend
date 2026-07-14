import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { LayoutComponent } from './layout.component';
import { AuthService } from '../../core/services/auth.service';
import { CashService } from '../../core/services/cash.service';
import { NotificationService } from '../../core/services/notification.service';
import { RemindersApiService } from '../../core/services/reminders-api.service';
import { User } from '../../core/models/user.model';

describe('LayoutComponent', () => {
  let currentUserSubject: BehaviorSubject<User | null>;
  let routerEvents: Subject<unknown>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let cashServiceSpy: jasmine.SpyObj<CashService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let remindersApiServiceSpy: jasmine.SpyObj<RemindersApiService>;

  const adminUser: User = {
    id: 'u1',
    username: 'admin',
    fullName: 'Admin',
    role: 'admin',
    isActive: true,
    createdAt: '',
  };

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<User | null>(null);
    routerEvents = new Subject();

    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser$: currentUserSubject.asObservable(),
    });
    cashServiceSpy = jasmine.createSpyObj('CashService', ['getCurrent']);
    notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['removeById', 'add'], {
      notifications$: of([]),
    });
    remindersApiServiceSpy = jasmine.createSpyObj('RemindersApiService', ['getUpcoming']);

    cashServiceSpy.getCurrent.and.returnValue(
      of({ isClosed: false, sessionDate: null } as any),
    );
    remindersApiServiceSpy.getUpcoming.and.returnValue(of({ today: [], tomorrow: [] }));

    const routerSpy = jasmine.createSpyObj('Router', ['navigate'], {
      url: '/app/dashboard',
      events: routerEvents.asObservable(),
    });

    await TestBed.configureTestingModule({
    imports: [LayoutComponent],
    providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: CashService, useValue: cashServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: RemindersApiService, useValue: remindersApiServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('resolves the initial page title from the router URL', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.currentPageTitle()).toBe('Inicio');
  });

  it('does not load fixed-booking reminders for a non-admin user', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    currentUserSubject.next({ ...adminUser, role: 'employee' });
    expect(remindersApiServiceSpy.getUpcoming).not.toHaveBeenCalled();
  });

  it('loads fixed-booking reminders and adds notifications for an admin user', () => {
    remindersApiServiceSpy.getUpcoming.and.returnValue(
      of({
        today: [
          {
            bookingId: 'b1',
            clientName: 'Juan',
            phoneNumber: null,
            courtName: 'Cancha 1',
            date: '2026-01-01',
            hour: '10:00',
          },
        ],
        tomorrow: [],
      }),
    );
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    currentUserSubject.next(adminUser);

    expect(remindersApiServiceSpy.getUpcoming).toHaveBeenCalled();
    expect(notificationServiceSpy.add).toHaveBeenCalled();
  });

  it('sets unclosedSessionDate when there is an open session from a previous day', () => {
    cashServiceSpy.getCurrent.and.returnValue(
      of({ isClosed: false, sessionDate: '2020-01-01' } as any),
    );
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.unclosedSessionDate()).toBe('2020-01-01');
  });

  it('toggleSidebar() flips isSidebarOpen', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isSidebarOpen()).toBe(false);
    fixture.componentInstance.toggleSidebar();
    expect(fixture.componentInstance.isSidebarOpen()).toBe(true);
  });

  it('goToCashRegister() clears the warning and navigates', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    fixture.componentInstance.unclosedSessionDate.set('2020-01-01');
    fixture.componentInstance.goToCashRegister();
    expect(fixture.componentInstance.unclosedSessionDate()).toBeNull();
  });

  it('formatUnclosedDate() returns an empty string for null input', () => {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.formatUnclosedDate(null)).toBe('');
  });
});
