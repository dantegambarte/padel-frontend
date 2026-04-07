import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CashRegisterRoutingModule } from './cash-register-routing.module';
import { CashRegisterComponent } from './cash-register.component';
import { SharedModule } from '../../shared/shared.module';
import { TicketModalModule } from './ticket-modal.module';

@NgModule({
  declarations: [CashRegisterComponent],
  imports: [
    CommonModule,
    FormsModule,
    CashRegisterRoutingModule,
    SharedModule,
    TicketModalModule,
  ],
})
export class CashRegisterModule {}
