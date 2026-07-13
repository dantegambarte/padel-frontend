import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';


@NgModule({
    imports: [CommonModule, FormsModule, UsersRoutingModule, UsersComponent],
})
export class UsersModule {}
