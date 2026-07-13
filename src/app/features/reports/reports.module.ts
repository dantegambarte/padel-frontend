import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';

import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './reports.component';


@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    NgChartsModule,
    ReportsRoutingModule,
    ReportsComponent,
],
})
export class ReportsModule {}
