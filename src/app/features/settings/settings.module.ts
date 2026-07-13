import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';


@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SettingsRoutingModule,
    SettingsComponent,
],
})
export class SettingsModule {}
