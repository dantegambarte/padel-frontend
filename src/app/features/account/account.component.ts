import { Component, HostListener, OnDestroy, signal } from '@angular/core';
import { Router, ActivatedRoute, NavigationStart, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';
import { NgIf, NgClass } from '@angular/common';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-account',
    templateUrl: './account.component.html',
    imports: [
        NgIf,
        ModalScrollLockDirective,
        ReactiveFormsModule,
        FormsModule,
        NgClass,
        RouterLink,
    ],
})
export class AccountComponent implements OnDestroy {
  form = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
  formError = signal('');
  isSubmitting = signal(false);
  showSuccess = signal(false);

  /** Controla la visibilidad del modal de aviso de cambio obligatorio. */
  showForcedModal = signal(false);

  private navSub: Subscription | null = null;

  constructor(
    public authService: AuthService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    if (this.isForced) {
      this.showForcedModal.set(true);
    }
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe((e) => {
        const nav = e as NavigationStart;
        if (this.isForced && !nav.url.startsWith('/app/account')) {
          this.showForcedModal.set(true);
        }
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  /** Usuario autenticado actualmente. */
  get currentUser(): User | null {
    return this.authService.currentUser;
  }

  /** Iniciales del nombre completo (máx. 2 letras). */
  get userInitials(): string {
    const name = this.currentUser?.fullName ?? '';
    return (
      name
        .trim()
        .split(/\s+/)
        .filter((n) => n.length > 0)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    );
  }

  /** `true` cuando el admin restableció la contraseña y el usuario debe cambiarla. */
  get isForced(): boolean {
    return !!this.currentUser?.mustChangePassword;
  }

  /** `true` cuando nueva y confirmación tienen al menos 6 caracteres y coinciden. */
  get passwordsMatch(): boolean {
    return (
      this.form.newPassword.length >= 6 &&
      this.form.newPassword === this.form.confirmPassword
    );
  }

  /** `true` cuando hay contenido en confirmación pero no coincide todavía. */
  get confirmMismatch(): boolean {
    return (
      this.form.confirmPassword.length > 0 &&
      this.form.newPassword !== this.form.confirmPassword
    );
  }

  /** El formulario está listo para enviarse. */
  get canSubmit(): boolean {
    return (
      !!this.form.currentPassword && this.passwordsMatch && !this.isSubmitting()
    );
  }

  @HostListener('document:keydown.escape')
  /** Navega al dashboard al presionar Escape (solo si el cambio de contraseña no es forzado). */
  onEscape(): void {
    if (!this.isForced) this.router.navigate(['/app/dashboard']);
  }

  /** Valida y envía el formulario de cambio de contraseña. */
  submitChange(): void {
    this.formError.set('');
    this.showSuccess.set(false);

    if (!this.form.currentPassword) {
      this.formError.set('La contraseña actual es obligatoria.');
      return;
    }
    if (!this.form.newPassword) {
      this.formError.set('La nueva contraseña es obligatoria.');
      return;
    }
    if (this.form.newPassword.length < 6) {
      this.formError.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.form.newPassword !== this.form.confirmPassword) {
      this.formError.set('Las contraseñas no coinciden.');
      return;
    }

    this.isSubmitting.set(true);
    const wasForced = this.isForced;
    this.authService
      .changeOwnPassword(this.form.currentPassword, this.form.newPassword)
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.form = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          };
          if (wasForced) {
            this.toast.success(
              'Contraseña actualizada',
              'Iniciá sesión con tu nueva contraseña.',
            );
            this.authService.logout();
          } else {
            this.toast.success(
              'Contraseña actualizada',
              'Tu nueva contraseña ya está activa.',
            );
            this.showSuccess.set(true);
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg =
            err?.error?.message ?? 'No se pudo actualizar la contraseña.';
          this.formError.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }
}
