import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NgIf, AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    imports: [
        NgIf,
        ReactiveFormsModule,
        AsyncPipe,
    ],
})
export class LoginComponent {
  form: FormGroup;
  errorMessage = signal('');
  isLoading = signal(false);
  showPassword = signal(false);

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * Inicializa el formulario reactivo con los campos `username` y `password`.
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public themeService: ThemeService,
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  /**
   * Envía las credenciales al servicio de autenticación.
   * Muestra mensajes de error descriptivos según el código HTTP recibido.
   */
  onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;

    this.errorMessage.set('');
    this.isLoading.set(true);

    const { username, password } = this.form.value;

    this.authService.login({ username, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          this.errorMessage.set(
            'Credenciales inválidas. Verificá usuario y contraseña.',
          );
        } else if (err.status === 0) {
          this.errorMessage.set('No se pudo conectar con el servidor.');
        } else {
          this.errorMessage.set('Error al iniciar sesión. Intentá nuevamente.');
        }
      },
    });
  }
}
