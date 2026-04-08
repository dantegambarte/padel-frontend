import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesListComponent } from './expenses-list/expenses-list.component';
import { ExpenseFormComponent } from './expense-form/expense-form.component';

@NgModule({
  declarations: [ExpensesListComponent, ExpenseFormComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ExpensesRoutingModule,
  ],
})
export class ExpensesModule {}
