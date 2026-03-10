import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CashRegisterRoutingModule } from './cash-register-routing.module';
import { CashRegisterComponent } from './cash-register.component';

@NgModule({
  declarations: [CashRegisterComponent],
  imports: [
    CommonModule,
    FormsModule,
    CashRegisterRoutingModule,
  ],
})
export class CashRegisterModule {}
