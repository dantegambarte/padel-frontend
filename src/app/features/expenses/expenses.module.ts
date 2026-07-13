import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


import { ExpensesRoutingModule } from './expenses-routing.module';
import { ExpensesListComponent } from './expenses-list/expenses-list.component';
import { ExpenseFormComponent } from './expense-form/expense-form.component';

@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ExpensesRoutingModule,
    ExpensesListComponent, ExpenseFormComponent,
],
})
export class ExpensesModule {}
