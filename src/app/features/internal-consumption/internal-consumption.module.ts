import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


import { InternalConsumptionFormComponent } from './internal-consumption-form/internal-consumption-form.component';
import { InternalConsumptionListComponent } from './internal-consumption-list/internal-consumption-list.component';
import { InternalConsumptionRoutingModule } from './internal-consumption-routing.module';
import { SettleDebtModalComponent } from './settle-debt-modal/settle-debt-modal.component';

@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InternalConsumptionRoutingModule,
    InternalConsumptionListComponent,
    InternalConsumptionFormComponent,
    SettleDebtModalComponent,
],
})
export class InternalConsumptionModule {}
