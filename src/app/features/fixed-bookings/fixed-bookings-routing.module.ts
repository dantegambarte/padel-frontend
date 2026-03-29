import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FixedBookingsComponent } from './fixed-bookings.component';

const routes: Routes = [{ path: '', component: FixedBookingsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FixedBookingsRoutingModule {}
