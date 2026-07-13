import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { SessionAlertComponent } from './session-alert.component';
import {
  SessionAlertService,
  SessionAlertType,
} from '../../core/services/session-alert.service';
import { AuthService } from '../../core/services/auth.service';

describe('SessionAlertComponent', () => {
  let alertSubject: Subject<SessionAlertType>;
  let sessionAlertServiceSpy: jasmine.SpyObj<SessionAlertService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    alertSubject = new Subject<SessionAlertType>();
    sessionAlertServiceSpy = jasmine.createSpyObj('SessionAlertService', ['dismiss'], {
      alert$: alertSubject.asObservable(),
    });
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);

    await TestBed.configureTestingModule({
    imports: [SessionAlertComponent],
    providers: [
        { provide: SessionAlertService, useValue: sessionAlertServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('creates and starts hidden', () => {
    const fixture = TestBed.createComponent(SessionAlertComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.visible).toBe(false);
  });

  it('becomes visible and sets alertType when the service emits a non-null alert', () => {
    const fixture = TestBed.createComponent(SessionAlertComponent);
    fixture.detectChanges();

    alertSubject.next('TOKEN_EXPIRED');

    expect(fixture.componentInstance.visible).toBe(true);
    expect(fixture.componentInstance.alertType).toBe('TOKEN_EXPIRED');
    expect(fixture.componentInstance.title).toBe('Sesión expirada');
  });

  it('shows the SESSION_OVERRIDDEN copy for that alert type', () => {
    const fixture = TestBed.createComponent(SessionAlertComponent);
    fixture.detectChanges();

    alertSubject.next('SESSION_OVERRIDDEN');

    expect(fixture.componentInstance.title).toBe('Sesión cerrada');
  });

  it('confirm() hides the alert, dismisses it and logs the user out', () => {
    const fixture = TestBed.createComponent(SessionAlertComponent);
    fixture.detectChanges();
    alertSubject.next('TOKEN_EXPIRED');

    fixture.componentInstance.confirm();

    expect(fixture.componentInstance.visible).toBe(false);
    expect(sessionAlertServiceSpy.dismiss).toHaveBeenCalled();
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('unsubscribes on destroy', () => {
    const fixture = TestBed.createComponent(SessionAlertComponent);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
