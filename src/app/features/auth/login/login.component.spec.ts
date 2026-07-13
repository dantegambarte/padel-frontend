import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

describe('LoginComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let themeServiceStub: { isDark$: BehaviorSubject<boolean> };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    themeServiceStub = { isDark$: new BehaviorSubject<boolean>(false) };

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ThemeService, useValue: themeServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('creates with an invalid empty form', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('onSubmit() does nothing while the form is invalid', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('onSubmit() logs in and navigates to dashboard on success', () => {
    authServiceSpy.login.and.returnValue(
      of({ accessToken: 'a', refreshToken: 'r', user: {} as any }),
    );
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'secret1' });

    fixture.componentInstance.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({
      username: 'admin',
      password: 'secret1',
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app/dashboard']);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('shows a specific message on 401', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 401 })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'wrongpass' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage).toContain('Credenciales inválidas');
  });

  it('shows a connectivity message on status 0', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 0 })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'secret1' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage).toContain('No se pudo conectar');
  });

  it('togglePasswordVisibility() flips showPassword', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.showPassword).toBe(false);
    fixture.componentInstance.togglePasswordVisibility();
    expect(fixture.componentInstance.showPassword).toBe(true);
  });
});
