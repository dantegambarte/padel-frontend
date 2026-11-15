import { TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ExpensesListComponent } from './expenses-list.component';
import { ExpensesService } from '../../../core/services/expenses.service';
import { AuthService } from '../../../core/services/auth.service';
import { Expense } from '../../../core/models/expense.model';

@Component({ selector: 'app-expense-form', template: '<div class="expense-form-stub"></div>' })
class ExpenseFormStubComponent {
  readonly expense = input<Expense | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();
}

describe('ExpensesListComponent', () => {
  let expensesServiceSpy: jasmine.SpyObj<ExpensesService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockExpense: Expense = {
    id: 'e1',
    amount: 5000,
    description: 'Pelotas',
    category: 'Insumos',
    paymentMethod: 'Efectivo',
    date: '2026-01-01',
    cashSessionId: null,
    createdByUserId: 'u1',
    createdByUser: { id: 'u1', fullName: 'Admin', role: 'admin' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  function setup(isAdmin: boolean) {
    expensesServiceSpy = jasmine.createSpyObj('ExpensesService', ['getAll', 'delete']);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      isAdmin,
      isAdminSignal: signal(isAdmin),
    });
    expensesServiceSpy.getAll.and.returnValue(of([mockExpense]));

    TestBed.overrideComponent(ExpensesListComponent, {
      set: { imports: [ReactiveFormsModule, FormsModule, NgClass, ExpenseFormStubComponent] },
    });
    TestBed.configureTestingModule({
    imports: [ExpensesListComponent],
    providers: [
        { provide: ExpensesService, useValue: expensesServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
    ],
});
  }

  it('loads expenses with a date range when the user is admin', () => {
    setup(true);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.expenses().length).toBe(1);
    expect(expensesServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ from: jasmine.any(String), to: jasmine.any(String) }),
    );
  });

  it('loads expenses with no filters when the user is an employee', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    expect(expensesServiceSpy.getAll).toHaveBeenCalledWith(undefined);
  });

  it('sets an error message when loading fails', () => {
    setup(false);
    expensesServiceSpy.getAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toContain('No se pudieron cargar');
  });

  it('totalAmount sums all listed expenses', () => {
    setup(false);
    expensesServiceSpy.getAll.and.returnValue(of([mockExpense, { ...mockExpense, id: 'e2', amount: 1000 }]));
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.totalAmount()).toBe(6000);
  });

  it('openCreateForm()/openEditForm()/closeForm() toggle showForm and selectedExpense', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCreateForm();
    expect(component.showForm()).toBe(true);
    expect(component.selectedExpense()).toBeNull();

    component.closeForm();
    component.openEditForm(mockExpense);
    expect(component.showForm()).toBe(true);
    expect(component.selectedExpense()).toEqual(mockExpense);

    component.closeForm();
    expect(component.showForm()).toBe(false);
    expect(component.selectedExpense()).toBeNull();
  });

  it('deleteExpense() does nothing when the user cancels the confirm dialog', () => {
    setup(false);
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteExpense('e1');

    expect(expensesServiceSpy.delete).not.toHaveBeenCalled();
  });

  it('deleteExpense() calls the service and reloads when confirmed', () => {
    setup(false);
    spyOn(window, 'confirm').and.returnValue(true);
    expensesServiceSpy.delete.and.returnValue(of(undefined));
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteExpense('e1');

    expect(expensesServiceSpy.delete).toHaveBeenCalledWith('e1');
  });

  it('categoryClass() falls back to a default class for unknown categories', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.categoryClass('Insumos')).toContain('blue');
    expect(fixture.componentInstance.categoryClass('Unknown')).toContain('bg-secondary');
  });

  it('creatorName() falls back to "Sistema" when createdByUser is missing', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.creatorName({ ...mockExpense, createdByUser: null })).toBe(
      'Sistema',
    );
  });

  it('renders a table row per expense and the empty state when there are none', () => {
    setup(false);
    expensesServiceSpy.getAll.and.returnValue(of([mockExpense, { ...mockExpense, id: 'e2', description: 'Red' }]));
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Pelotas');
    expect(el.textContent).not.toContain('No hay egresos registrados');

    fixture.componentInstance.expenses.set([]);
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(0);
    expect(el.textContent).toContain('No hay egresos registrados');
  });

  it('renders the expense form only while showForm is true', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpensesListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-expense-form')).toBeNull();

    fixture.componentInstance.openCreateForm();
    fixture.detectChanges();
    expect(el.querySelector('app-expense-form')).not.toBeNull();
  });
});
