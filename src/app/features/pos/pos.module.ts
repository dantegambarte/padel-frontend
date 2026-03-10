import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PosRoutingModule } from './pos-routing.module';
import { PosComponent } from './pos.component';

@NgModule({
  declarations: [PosComponent],
  imports: [
    CommonModule,       // [ngClass], [ngStyle]
    FormsModule,        // [(ngModel)] en montoEfectivo / montoTransferencia / searchQuery
    PosRoutingModule,
  ],
})
export class PosModule {}
