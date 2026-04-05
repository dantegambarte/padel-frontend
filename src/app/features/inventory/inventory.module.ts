import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryAlertsComponent } from './inventory-alerts/inventory-alerts.component';

@NgModule({
  declarations: [InventoryAlertsComponent],
  imports: [CommonModule, InventoryRoutingModule],
})
export class InventoryModule {}
