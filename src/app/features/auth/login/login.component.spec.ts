import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

describe('LoginComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let themeServiceStub: { isDark: ReturnType<typeof signal<boolean>> };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    themeServiceStub = { isDark: signal<boolean>(false) };

    await TestBed.configureTestingModule({
    imports: [ReactiveFormsModule, LoginComponent],
    providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ThemeService, useValue: themeServiceStub },
    ],
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
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('shows a specific message on 401', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 401 })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'wrongpass' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage()).toContain('Credenciales inválidas');
  });

  it('shows a connectivity message on status 0', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 0 })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'secret1' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.errorMessage()).toContain('No se pudo conectar');
  });

  it('togglePasswordVisibility() flips showPassword', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.showPassword()).toBe(false);
    fixture.componentInstance.togglePasswordVisibility();
    expect(fixture.componentInstance.showPassword()).toBe(true);
  });

  it('renders the error banner only after a failed login', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 401 })));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Credenciales inválidas');

    fixture.componentInstance.form.setValue({ username: 'admin', password: 'wrongpass' });
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    expect(el.textContent).toContain('Credenciales inválidas');
  });

  it('renders the submit button label for the idle and loading states', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.textContent).toContain('Iniciar Sesión');

    fixture.componentInstance.isLoading.set(true);
    fixture.detectChanges();
    expect(button.textContent).toContain('Iniciando sesión...');
  });
});

describe('LoginComponent footer', () => {
  it('links to the privacy notice and third-party licenses', async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['login']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ThemeService, useValue: { isDark: signal<boolean>(false) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('footer a[href="/privacy"]')).not.toBeNull();
    expect(el.querySelector('footer a[href="/3rdpartylicenses.txt"]')).not.toBeNull();
  });
});
