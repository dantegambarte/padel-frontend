import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { FixedBookingsRoutingModule } from './fixed-bookings-routing.module';
import { FixedBookingsComponent } from './fixed-bookings.component';

@NgModule({
    imports: [CommonModule, FormsModule, SharedModule, FixedBookingsRoutingModule, FixedBookingsComponent],
})
export class FixedBookingsModule {}
