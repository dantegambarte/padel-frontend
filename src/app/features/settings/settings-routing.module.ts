import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SettingsComponent } from './settings.component';
import { UnsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

const routes: Routes = [
  {
    path: '',
    component: SettingsComponent,
    canDeactivate: [UnsavedChangesGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
