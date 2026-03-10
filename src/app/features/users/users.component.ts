import { Component, OnInit, HostListener } from '@angular/core';

import { UsersService } from '../../core/services/users.service';
import { AuthService }  from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User, CreateUserDto } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {

  users:       User[] = [];
  isLoading    = true;
  isDialogOpen = false;
  isSubmitting = false;
  togglingId:  string | null = null;

  form = { username: '', fullName: '', password: '', confirmPassword: '' };
  formError = '';

  constructor(
    private usersService: UsersService,
    private authService:  AuthService,
    private toast:        ToastService,
  ) {}

  ngOnInit(): void { this.loadUsers(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.isDialogOpen) this.closeDialog(); }

  get currentUserId(): string { return this.authService.currentUser?.id ?? ''; }

  canToggle(user: User): boolean {
    return user.role !== 'admin' && user.id !== this.currentUserId;
  }

  private loadUsers(): void {
    this.isLoading = true;
    this.usersService.findAll().subscribe({
      next:  (data) => { this.users = data; this.isLoading = false; },
      error: ()     => {
        this.toast.error('Error al cargar usuarios', 'Intente recargar la página');
        this.isLoading = false;
      },
    });
  }

  openDialog(): void {
    this.form = { username: '', fullName: '', password: '', confirmPassword: '' };
    this.formError    = '';
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    if (this.isSubmitting) return;
    this.isDialogOpen = false;
  }

  submitForm(): void {
    this.formError = '';

    if (!this.form.username.trim() || !this.form.fullName.trim() || !this.form.password) {
      this.formError = 'Todos los campos son obligatorios.';
      return;
    }
    if (this.form.password.length < 6) {
      this.formError = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (this.form.password !== this.form.confirmPassword) {
      this.formError = 'Las contraseñas no coinciden.';
      return;
    }

    const dto: CreateUserDto = {
      username: this.form.username.trim().toLowerCase(),
      fullName: this.form.fullName.trim(),
      password: this.form.password,
    };

    this.isSubmitting = true;
    this.usersService.create(dto).subscribe({
      next: (created) => {
        this.isSubmitting = false;
        this.isDialogOpen  = false;
        this.toast.success(
          'Empleado creado exitosamente',
          `"${created.username}" ya puede iniciar sesión`,
        );
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message ?? 'No se pudo crear el empleado';
        this.formError = Array.isArray(msg) ? msg.join(', ') : msg;
      },
    });
  }

  toggleStatus(user: User): void {
    if (!this.canToggle(user) || this.togglingId) return;
    this.togglingId = user.id;

    this.usersService.toggleStatus(user.id, user.isActive).subscribe({
      next: (updated) => {
        this.togglingId = null;
        this.users = this.users.map(u => u.id === updated.id ? updated : u);
        const label = updated.isActive ? 'activado' : 'desactivado';
        this.toast.success(`Usuario ${label}`, `${updated.fullName} fue ${label} exitosamente`);
      },
      error: () => {
        this.togglingId = null;
        this.toast.error('Error al actualizar estado', 'Intente nuevamente');
      },
    });
  }

  formatDate(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
  }
}
