import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InventoryAlertsComponent } from './inventory-alerts/inventory-alerts.component';
import { adminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  {
    path: 'alerts',
    component: InventoryAlertsComponent,
    canActivate: [adminGuard],
    data: { roles: ['admin'] },
  },
  { path: '', redirectTo: 'alerts', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryRoutingModule {}
