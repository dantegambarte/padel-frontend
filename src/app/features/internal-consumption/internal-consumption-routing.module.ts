import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InternalConsumptionListComponent } from './internal-consumption-list/internal-consumption-list.component';

const routes: Routes = [
  { path: '', component: InternalConsumptionListComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InternalConsumptionRoutingModule {}
