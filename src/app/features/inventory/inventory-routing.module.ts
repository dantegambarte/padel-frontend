import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InventoryAlertsComponent } from './inventory-alerts/inventory-alerts.component';
import { AdminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  {
    path: 'alerts',
    component: InventoryAlertsComponent,
    canActivate: [AdminGuard],
  },
  { path: '', redirectTo: 'alerts', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InventoryRoutingModule {}
