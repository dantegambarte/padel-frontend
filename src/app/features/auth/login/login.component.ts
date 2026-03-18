import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  form: FormGroup;
  errorMessage = '';
  isLoading = false;

  /**
   * Inicializa el formulario reactivo con los campos `username` y `password`.
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
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
    if (this.form.invalid || this.isLoading) return;

    this.errorMessage = '';
    this.isLoading = true;

    const { username, password } = this.form.value;

    this.authService.login({ username, password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage =
            'Credenciales inválidas. Verificá usuario y contraseña.';
        } else if (err.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor.';
        } else {
          this.errorMessage = 'Error al iniciar sesión. Intentá nuevamente.';
        }
      },
    });
  }
}
