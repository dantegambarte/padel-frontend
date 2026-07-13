import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { UsersComponent } from './users.component';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';

describe('UsersComponent', () => {
  let usersServiceSpy: jasmine.SpyObj<UsersService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  const mockUser: User = {
    id: 'u1',
    username: 'empleado',
    fullName: 'Empleado Uno',
    role: 'employee',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    usersServiceSpy = jasmine.createSpyObj('UsersService', [
      'findAll',
      'create',
      'update',
      'remove',
      'toggleStatus',
      'resetPassword',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: { id: 'admin-1' },
    });
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    usersServiceSpy.findAll.and.returnValue(of([mockUser]));

    await TestBed.configureTestingModule({
      declarations: [UsersComponent],
      providers: [
        { provide: UsersService, useValue: usersServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('loads users on init', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.users).toEqual([mockUser]);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('canToggle() is false for the currently logged-in user', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.canToggle({ ...mockUser, id: 'admin-1' })).toBe(false);
    expect(fixture.componentInstance.canToggle(mockUser)).toBe(true);
  });

  it('submitForm() requires all fields', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDialog();
    fixture.componentInstance.submitForm();
    expect(fixture.componentInstance.formError).toContain('obligatorios');
  });

  it('submitForm() requires matching passwords', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDialog();
    const component = fixture.componentInstance;
    component.form = {
      username: 'nuevo',
      fullName: 'Nuevo',
      password: 'secret123',
      confirmPassword: 'different',
      role: 'employee',
    };
    component.submitForm();
    expect(component.formError).toContain('no coinciden');
  });

  it('submitForm() creates the user on valid input', () => {
    usersServiceSpy.create.and.returnValue(of(mockUser));
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDialog();
    const component = fixture.componentInstance;
    component.form = {
      username: 'nuevo',
      fullName: 'Nuevo',
      password: 'secret123',
      confirmPassword: 'secret123',
      role: 'employee',
    };

    component.submitForm();

    expect(usersServiceSpy.create).toHaveBeenCalled();
    expect(component.isDialogOpen).toBe(false);
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('toggleStatus() sends the inverse status and updates the local list', () => {
    usersServiceSpy.toggleStatus.and.returnValue(of({ ...mockUser, isActive: false }));
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleStatus(mockUser);

    expect(usersServiceSpy.toggleStatus).toHaveBeenCalledWith('u1', true);
    expect(fixture.componentInstance.users[0].isActive).toBe(false);
  });

  it('deleteUser() does nothing without confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.deleteUser(mockUser);
    expect(usersServiceSpy.remove).not.toHaveBeenCalled();
  });

  it('deleteUser() removes the user locally when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    usersServiceSpy.remove.and.returnValue(of(undefined));
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteUser(mockUser);

    expect(fixture.componentInstance.users.length).toBe(0);
  });

  it('submitReset() requires a password of at least 6 characters', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openResetModal(mockUser);
    fixture.componentInstance.resetPassword = '123';
    fixture.componentInstance.submitReset();
    expect(fixture.componentInstance.resetPasswordError).toContain('al menos 6');
  });

  it('submitReset() calls the service and closes the modal on success', () => {
    usersServiceSpy.resetPassword.and.returnValue(of({ success: true, message: 'ok' }));
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openResetModal(mockUser);
    fixture.componentInstance.resetPassword = 'newpass1';

    fixture.componentInstance.submitReset();

    expect(usersServiceSpy.resetPassword).toHaveBeenCalledWith('u1', 'newpass1');
    expect(fixture.componentInstance.isResetOpen).toBe(false);
  });

  it('onEscape() closes whichever modal is open', () => {
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDialog();
    fixture.componentInstance.onEscape();
    expect(fixture.componentInstance.isDialogOpen).toBe(false);
  });
});
