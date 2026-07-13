import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AccountRoutingModule } from './account-routing.module';
import { AccountComponent } from './account.component';


@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AccountRoutingModule,
    AccountComponent,
],
})
export class AccountModule {}
