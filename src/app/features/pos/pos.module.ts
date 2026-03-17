import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PosRoutingModule } from './pos-routing.module';
import { PosComponent } from './pos.component';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@NgModule({
  declarations: [PosComponent],
  imports: [CommonModule, FormsModule, PosRoutingModule, CashRegisterModule],
})
export class PosModule {}
