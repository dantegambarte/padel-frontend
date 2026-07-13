import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ExpenseFormComponent } from './expense-form.component';
import { ExpensesService } from '../../../core/services/expenses.service';
import { DraftService } from '../../../core/services/draft.service';
import { AuthService } from '../../../core/services/auth.service';
import { Expense } from '../../../core/models/expense.model';

describe('ExpenseFormComponent', () => {
  let expensesServiceSpy: jasmine.SpyObj<ExpensesService>;
  let draftServiceSpy: jasmine.SpyObj<DraftService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockExpense: Expense = {
    id: 'e1',
    amount: 5000,
    description: 'Pelotas',
    category: 'Insumos',
    paymentMethod: 'Efectivo',
    date: '2026-01-01',
    cashSessionId: null,
    createdByUserId: 'u1',
    createdByUser: null,
    createdAt: '',
    updatedAt: '',
  };

  function setup(isAdmin: boolean) {
    expensesServiceSpy = jasmine.createSpyObj('ExpensesService', ['create', 'update']);
    draftServiceSpy = jasmine.createSpyObj('DraftService', [
      'getDraft',
      'saveDraft',
      'clearDraft',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], { isAdmin });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    draftServiceSpy.getDraft.and.returnValue(null);

    TestBed.configureTestingModule({
    imports: [ReactiveFormsModule, ExpenseFormComponent],
    providers: [
        { provide: ExpensesService, useValue: expensesServiceSpy },
        { provide: DraftService, useValue: draftServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('creates in create-mode with defaults and no draft', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isEditMode).toBe(false);
    expect(fixture.componentInstance.draftRestored).toBe(false);
  });

  it('categories excludes Sueldos for non-admin users', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.categories).not.toContain('Sueldos');
  });

  it('categories includes Sueldos for admin users', () => {
    setup(true);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.categories).toContain('Sueldos');
  });

  it('shows draftRestored when a draft exists', () => {
    setup(false);
    draftServiceSpy.getDraft.and.returnValue({ amount: 1000 });
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.draftRestored).toBe(true);
  });

  it('applyDraft() patches the form and clears the restoration banner', () => {
    setup(false);
    draftServiceSpy.getDraft.and.returnValue({ description: 'Restored' });
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.applyDraft();
    expect(fixture.componentInstance.form.value.description).toBe('Restored');
    expect(fixture.componentInstance.draftRestored).toBe(false);
  });

  it('pre-fills the form in edit mode from the given expense', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentInstance.expense = mockExpense;
    fixture.detectChanges();
    expect(fixture.componentInstance.isEditMode).toBe(true);
    expect(fixture.componentInstance.form.value.amount).toBe(5000);
  });

  it('onSubmit() marks all as touched and does not submit when the form is invalid', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ amount: null });
    fixture.componentInstance.onSubmit();
    expect(expensesServiceSpy.create).not.toHaveBeenCalled();
  });

  it('onSubmit() creates a new expense and emits saved on success', () => {
    setup(false);
    expensesServiceSpy.create.and.returnValue(of(mockExpense));
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ amount: 5000, description: 'Pelotas' });
    const emitSpy = spyOn(fixture.componentInstance.saved, 'emit');

    fixture.componentInstance.onSubmit();

    expect(expensesServiceSpy.create).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
    expect(draftServiceSpy.clearDraft).toHaveBeenCalled();
  });

  it('onSubmit() updates an existing expense in edit mode', () => {
    setup(false);
    expensesServiceSpy.update.and.returnValue(of(mockExpense));
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentInstance.expense = mockExpense;
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(expensesServiceSpy.update).toHaveBeenCalledWith('e1', jasmine.any(Object));
  });

  it('onSubmit() shows the open-cash panel on a CAJA_CERRADA error', () => {
    setup(false);
    expensesServiceSpy.create.and.returnValue(
      throwError(() => ({ error: { errorCode: 'CAJA_CERRADA', message: '' } })),
    );
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ amount: 5000, description: 'Pelotas' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.showOpenCashPanel).toBe(true);
    expect(fixture.componentInstance.serverError).toBeNull();
  });

  it('onSubmit() shows a generic server error otherwise', () => {
    setup(false);
    expensesServiceSpy.create.and.returnValue(
      throwError(() => ({ error: { message: 'Error genérico' } })),
    );
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({ amount: 5000, description: 'Pelotas' });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.serverError).toBe('Error genérico');
  });

  it('irAbrirCaja() navigates to cash-register', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    fixture.componentInstance.irAbrirCaja();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app/cash-register']);
  });

  it('onCancel() emits cancelled', () => {
    setup(false);
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.detectChanges();
    const emitSpy = spyOn(fixture.componentInstance.cancelled, 'emit');
    fixture.componentInstance.onCancel();
    expect(emitSpy).toHaveBeenCalled();
  });
});
