import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { NgIf } from '@angular/common';
import { DashboardAdminComponent } from './admin/dashboard-admin.component';
import { DashboardEmployeeComponent } from './employee/dashboard-employee.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    imports: [
        NgIf,
        DashboardAdminComponent,
        DashboardEmployeeComponent,
    ],
})
export class DashboardComponent {
  constructor(private authService: AuthService) {}

  /** Devuelve `true` si el usuario autenticado tiene rol de administrador. */
  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }
}
