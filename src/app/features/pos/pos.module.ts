import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PosRoutingModule } from './pos-routing.module';
import { PosComponent } from './pos.component';
import { TicketModalModule } from '../cash-register/ticket-modal.module';

@NgModule({
  declarations: [PosComponent],
  imports: [CommonModule, FormsModule, PosRoutingModule, TicketModalModule],
})
export class PosModule {}
