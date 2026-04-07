import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AccountRoutingModule } from './account-routing.module';
import { AccountComponent } from './account.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [AccountComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AccountRoutingModule,
    SharedModule,
  ],
})
export class AccountModule {}
