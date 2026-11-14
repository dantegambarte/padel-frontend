import { ChangeDetectionStrategy, Component, HostListener, OnInit, signal } from '@angular/core';

import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserRole,
} from '../../core/models/user.model';
import { NgClass } from '@angular/common';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
    NgClass,
    ModalScrollLockDirective,
    ReactiveFormsModule,
    FormsModule
],
})
export class UsersComponent implements OnInit {
  readonly users = signal<User[]>([]);
  readonly isLoading = signal(true);
  readonly isDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly togglingId = signal<string | null>(null);

  readonly isEditOpen = signal(false);
  readonly editingUser = signal<User | null>(null);
  editForm = { fullName: '', password: '', role: 'employee' as UserRole };
  readonly editFormError = signal('');
  readonly isEditSubmitting = signal(false);

  /** Estado del modal de restablecimiento de contraseña. */
  readonly isResetOpen = signal(false);
  readonly resetTargetUser = signal<User | null>(null);
  resetPassword = '';
  readonly resetPasswordError = signal('');
  readonly isResetSubmitting = signal(false);

  readonly deletingId = signal<string | null>(null);

  form = {
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'employee' as UserRole,
  };
  readonly formError = signal('');

  readonly ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'employee', label: 'Empleado' },
    { value: 'admin', label: 'Administrador' },
  ];

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  @HostListener('document:keydown.escape')
  /** Cierra el modal abierto al presionar Escape. */
  onEscape(): void {
    if (this.isDialogOpen()) this.closeDialog();
    if (this.isEditOpen()) this.closeEditModal();
    if (this.isResetOpen()) this.closeResetModal();
  }

  /** ID del usuario actualmente autenticado. */
  get currentUserId(): string {
    return this.authService.currentUser?.id ?? '';
  }

  /** `true` si el usuario dado puede ser activado/desactivado (no es el usuario logueado). */
  canToggle(user: User): boolean {
    return user.id !== this.currentUserId;
  }

  /** Carga la lista de usuarios desde el servidor. */
  private loadUsers(): void {
    this.isLoading.set(true);
    this.usersService.findAll().subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error(
          'Error al cargar usuarios',
          'Intente recargar la página',
        );
        this.isLoading.set(false);
      },
    });
  }

  /** Abre el diálogo de creación de usuario con el formulario vacío. */
  openDialog(): void {
    this.form = {
      username: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      role: 'employee',
    };
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  /** Cierra el diálogo de creación si no hay una petición en curso. */
  closeDialog(): void {
    if (this.isSubmitting()) return;
    this.isDialogOpen.set(false);
  }

  /** Valida y envía el formulario de creación de usuario. */
  submitForm(): void {
    this.formError.set('');

    if (
      !this.form.username.trim() ||
      !this.form.fullName.trim() ||
      !this.form.password
    ) {
      this.formError.set('Todos los campos son obligatorios.');
      return;
    }
    if (this.form.password.length < 6) {
      this.formError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.form.password !== this.form.confirmPassword) {
      this.formError.set('Las contraseñas no coinciden.');
      return;
    }

    const dto: CreateUserDto = {
      username: this.form.username.trim().toLowerCase(),
      fullName: this.form.fullName.trim(),
      password: this.form.password,
      role: this.form.role,
    };

    this.isSubmitting.set(true);
    this.usersService.create(dto).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.isDialogOpen.set(false);
        this.toast.success(
          'Usuario creado exitosamente',
          `"${created.username}" ya puede iniciar sesión`,
        );
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.message ?? 'No se pudo crear el usuario';
        this.formError.set(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  /** Abre el modal de edición pre-cargando los datos del usuario. */
  openEditModal(user: User): void {
    this.editingUser.set(user);
    this.editForm = { fullName: user.fullName, password: '', role: user.role };
    this.editFormError.set('');
    this.isEditOpen.set(true);
  }

  /** Cierra el modal de edición si no hay una petición en curso. */
  closeEditModal(): void {
    if (this.isEditSubmitting()) return;
    this.isEditOpen.set(false);
    this.editingUser.set(null);
  }

  /** Valida y envía el formulario de edición de usuario. */
  submitEdit(): void {
    this.editFormError.set('');
    if (!this.editForm.fullName.trim()) {
      this.editFormError.set('El nombre completo es obligatorio.');
      return;
    }
    if (this.editForm.password && this.editForm.password.length < 6) {
      this.editFormError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const dto: UpdateUserDto = {
      fullName: this.editForm.fullName.trim(),
      role: this.editForm.role,
    };
    if (this.editForm.password) dto.password = this.editForm.password;

    this.isEditSubmitting.set(true);
    this.usersService.update(this.editingUser()!.id, dto).subscribe({
      next: (updated) => {
        this.isEditSubmitting.set(false);
        this.isEditOpen.set(false);
        this.users.set(this.users().map((u) => (u.id === updated.id ? updated : u)));
        this.toast.success(
          'Usuario actualizado',
          `${updated.fullName} fue actualizado exitosamente`,
        );
      },
      error: (err) => {
        this.isEditSubmitting.set(false);
        const msg = err?.error?.message ?? 'No se pudo actualizar el usuario';
        this.editFormError.set(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  /** Abre el modal de restablecimiento de contraseña para el usuario indicado. */
  openResetModal(user: User): void {
    this.resetTargetUser.set(user);
    this.resetPassword = '';
    this.resetPasswordError.set('');
    this.isResetOpen.set(true);
  }

  /** Cierra el modal de restablecimiento si no hay una petición en curso. */
  closeResetModal(): void {
    if (this.isResetSubmitting()) return;
    this.isResetOpen.set(false);
    this.resetTargetUser.set(null);
  }

  /** Valida y envía la nueva contraseña al backend para que la hashee y persista. */
  submitReset(): void {
    this.resetPasswordError.set('');

    if (!this.resetPassword) {
      this.resetPasswordError.set('La nueva contraseña es obligatoria.');
      return;
    }
    if (this.resetPassword.length < 6) {
      this.resetPasswordError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isResetSubmitting.set(true);
    this.usersService
      .resetPassword(this.resetTargetUser()!.id, this.resetPassword)
      .subscribe({
        next: () => {
          this.isResetSubmitting.set(false);
          this.isResetOpen.set(false);
          this.toast.success(
            'Contraseña restablecida',
            `La contraseña de "${this.resetTargetUser()!.fullName}" fue actualizada`,
          );
          this.resetTargetUser.set(null);
        },
        error: (err) => {
          this.isResetSubmitting.set(false);
          const msg =
            err?.error?.message ?? 'No se pudo restablecer la contraseña';
          this.resetPasswordError.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  /** Solicita confirmación y elimina el usuario indicado. */
  deleteUser(user: User): void {
    if (
      !confirm(
        `¿Eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    this.deletingId.set(user.id);
    this.usersService.remove(user.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.users.set(this.users().filter((u) => u.id !== user.id));
        this.toast.success(
          'Usuario eliminado',
          `"${user.username}" fue eliminado del sistema`,
        );
      },
      error: (err) => {
        this.deletingId.set(null);
        const msg = err?.error?.message ?? 'No se pudo eliminar el usuario';
        this.toast.error(
          'Error al eliminar',
          Array.isArray(msg) ? msg.join(', ') : msg,
        );
      },
    });
  }

  /** Activa o desactiva el usuario indicado (no se puede aplicar al propio usuario logueado). */
  toggleStatus(user: User): void {
    if (!this.canToggle(user) || this.togglingId()) return;
    this.togglingId.set(user.id);

    this.usersService.toggleStatus(user.id, user.isActive).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.users.set(this.users().map((u) => (u.id === updated.id ? updated : u)));
        const label = updated.isActive ? 'activado' : 'desactivado';
        this.toast.success(
          `Usuario ${label}`,
          `${updated.fullName} fue ${label} exitosamente`,
        );
      },
      error: (err) => {
        this.togglingId.set(null);
        const msg = err?.error?.message ?? 'Intente nuevamente';
        this.toast.error(
          'Error al actualizar estado',
          Array.isArray(msg) ? msg.join(', ') : msg,
        );
      },
    });
  }

  /** Formatea una fecha ISO como string localizado en formato argentino. */
  formatDate(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
  }
}
