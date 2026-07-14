import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AccountComponent } from './account.component';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

describe('AccountComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let routerEvents: Subject<unknown>;

  function setup(currentUser: any) {
    routerEvents = new Subject();
    authServiceSpy = jasmine.createSpyObj('AuthService', ['changeOwnPassword', 'logout'], {
      currentUser,
    });
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate'], { events: routerEvents.asObservable() });

    TestBed.configureTestingModule({
    imports: [AccountComponent],
    providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: {} },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('does not show the forced modal for a user without mustChangePassword', () => {
    setup({ fullName: 'Admin Test', mustChangePassword: false });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.showForcedModal()).toBe(false);
  });

  it('shows the forced modal immediately when mustChangePassword is true', () => {
    setup({ fullName: 'Admin Test', mustChangePassword: true });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.showForcedModal()).toBe(true);
  });

  it('userInitials returns up to two uppercase initials', () => {
    setup({ fullName: 'Juan Perez', mustChangePassword: false });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.userInitials).toBe('JP');
  });

  it('submitChange() rejects an empty current password', () => {
    setup({ fullName: 'Admin', mustChangePassword: false });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    fixture.componentInstance.submitChange();
    expect(fixture.componentInstance.formError()).toContain('actual es obligatoria');
  });

  it('submitChange() rejects mismatched passwords', () => {
    setup({ fullName: 'Admin', mustChangePassword: false });
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form = { currentPassword: 'old', newPassword: 'newpass1', confirmPassword: 'different' };
    component.submitChange();
    expect(component.formError()).toContain('no coinciden');
  });

  it('submitChange() calls the service and shows success on a normal (non-forced) change', () => {
    setup({ fullName: 'Admin', mustChangePassword: false });
    authServiceSpy.changeOwnPassword.and.returnValue(
      of({ success: true, message: 'ok' }),
    );
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form = { currentPassword: 'old', newPassword: 'newpass1', confirmPassword: 'newpass1' };

    component.submitChange();

    expect(authServiceSpy.changeOwnPassword).toHaveBeenCalledWith('old', 'newpass1');
    expect(component.showSuccess()).toBe(true);
    expect(authServiceSpy.logout).not.toHaveBeenCalled();
  });

  it('submitChange() logs the user out when the change was forced', () => {
    setup({ fullName: 'Admin', mustChangePassword: true });
    authServiceSpy.changeOwnPassword.and.returnValue(
      of({ success: true, message: 'ok' }),
    );
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form = { currentPassword: 'old', newPassword: 'newpass1', confirmPassword: 'newpass1' };

    component.submitChange();

    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('submitChange() surfaces the server error message', () => {
    setup({ fullName: 'Admin', mustChangePassword: false });
    authServiceSpy.changeOwnPassword.and.returnValue(
      throwError(() => ({ error: { message: 'Contraseña actual incorrecta' } })),
    );
    const fixture = TestBed.createComponent(AccountComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form = { currentPassword: 'wrong', newPassword: 'newpass1', confirmPassword: 'newpass1' };

    component.submitChange();

    expect(component.formError()).toBe('Contraseña actual incorrecta');
    expect(component.isSubmitting()).toBe(false);
  });
});
