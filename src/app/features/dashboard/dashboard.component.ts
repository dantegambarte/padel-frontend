import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  constructor(private authService: AuthService) {}

  /** Devuelve `true` si el usuario autenticado tiene rol de administrador. */
  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }
}
