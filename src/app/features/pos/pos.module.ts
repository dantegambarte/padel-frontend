import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PosRoutingModule } from './pos-routing.module';
import { PosComponent } from './pos.component';


@NgModule({
    imports: [CommonModule, FormsModule, PosRoutingModule, PosComponent],
})
export class PosModule {}
