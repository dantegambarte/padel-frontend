import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CashRegisterRoutingModule } from './cash-register-routing.module';
import { CashRegisterComponent } from './cash-register.component';
import { TicketModalComponent } from './ticket-modal.component';

@NgModule({
  declarations: [CashRegisterComponent, TicketModalComponent],
  imports: [CommonModule, FormsModule, CashRegisterRoutingModule],
  exports: [TicketModalComponent],
})
export class CashRegisterModule {}
