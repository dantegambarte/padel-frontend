import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PricingShiftsComponent } from './pricing-shifts.component';

const routes: Routes = [{ path: '', component: PricingShiftsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PricingShiftsRoutingModule {}
