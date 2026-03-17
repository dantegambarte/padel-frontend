import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CashRegisterRoutingModule } from './cash-register-routing.module';
import { CashRegisterComponent } from './cash-register.component';
import { TicketModalComponent } from './ticket-modal.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [CashRegisterComponent, TicketModalComponent],
  imports: [CommonModule, FormsModule, CashRegisterRoutingModule, SharedModule],
  exports: [TicketModalComponent],
})
export class CashRegisterModule {}
