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
    imports: [CommonModule, RouterModule, NgChartsModule, DashboardRoutingModule, DashboardComponent,
        DashboardAdminComponent,
        DashboardEmployeeComponent,
        StatCardComponent],
})
export class DashboardModule {}
