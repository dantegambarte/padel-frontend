import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
    imports: [CommonModule, FormsModule, UsersRoutingModule, SharedModule, UsersComponent],
})
export class UsersModule {}
