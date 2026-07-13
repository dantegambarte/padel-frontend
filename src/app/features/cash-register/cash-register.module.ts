import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CashRegisterRoutingModule } from './cash-register-routing.module';
import { CashRegisterComponent } from './cash-register.component';



@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    CashRegisterRoutingModule,
    CashRegisterComponent,
],
})
export class CashRegisterModule {}
