import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * DashboardComponent — Shell de enrutamiento.
 * Lee el rol del usuario y delega a <app-dashboard-admin>
 * o <app-dashboard-employee> según corresponda.
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  constructor(private authService: AuthService) {}

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }
}
