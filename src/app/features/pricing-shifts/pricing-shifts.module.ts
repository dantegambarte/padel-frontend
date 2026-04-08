import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { PricingShiftsRoutingModule } from './pricing-shifts-routing.module';
import { PricingShiftsComponent } from './pricing-shifts.component';

@NgModule({
  declarations: [PricingShiftsComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    PricingShiftsRoutingModule,
  ],
})
export class PricingShiftsModule {}
