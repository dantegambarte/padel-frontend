import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryAlertsComponent } from './inventory-alerts/inventory-alerts.component';

@NgModule({
    imports: [CommonModule, FormsModule, InventoryRoutingModule, InventoryAlertsComponent],
})
export class InventoryModule {}
