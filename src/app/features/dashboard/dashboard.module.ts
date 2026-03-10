import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgChartsModule } from 'ng2-charts';

import { DashboardRoutingModule } from './dashboard-routing.module';

import { DashboardComponent } from './dashboard.component';
import { DashboardAdminComponent } from './admin/dashboard-admin.component';
import { DashboardEmployeeComponent } from './employee/dashboard-employee.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';

@NgModule({
  declarations: [
    DashboardComponent,
    DashboardAdminComponent,
    DashboardEmployeeComponent,
    StatCardComponent,        // Shared dentro del módulo — admin y employee lo usan
  ],
  imports: [
    CommonModule,             // *ngIf, *ngFor, *ngSwitch, [ngClass], [ngStyle]
    RouterModule,             // routerLink en los accesos rápidos del dashboard employee
    NgChartsModule,           // baseChart directive + ng2-charts v5
    DashboardRoutingModule,
  ],
})
export class DashboardModule {}
