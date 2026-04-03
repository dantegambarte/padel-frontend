import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  Expense,
  ExpenseCategory,
  PaymentMethod,
} from '../../../core/models/expense.model';
import { ExpensesService } from '../../../core/services/expenses.service';

@Component({
  selector: 'app-expense-form',
  templateUrl: './expense-form.component.html',
})
export class ExpenseFormComponent implements OnInit {
  /** Si se pasa un Expense existente, el formulario trabaja en modo edición. */
  @Input() expense: Expense | null = null;

  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  submitting = false;
  serverError: string | null = null;

  showOpenCashPanel = false;

  readonly categories: ExpenseCategory[] = [
    'Insumos',
    'Mantenimiento',
    'Sueldos',
    'Servicios',
    'Otro',
  ];

  readonly paymentMethods: PaymentMethod[] = [
    'Efectivo',
    'Transferencia',
    'Tarjeta',
    'Otro',
  ];

  get isEditMode(): boolean {
    return !!this.expense;
  }

  constructor(
    private fb: FormBuilder,
    private expensesService: ExpensesService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const d     = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.form = this.fb.group({
      amount: [
        this.expense?.amount ?? null,
        [Validators.required, Validators.min(0.01)],
      ],
      description: [
        this.expense?.description ?? '',
        [Validators.required, Validators.maxLength(255)],
      ],
      category: [
        this.expense?.category ?? 'Otro',
        Validators.required,
      ],
      paymentMethod: [
        this.expense?.paymentMethod ?? 'Efectivo',
        Validators.required,
      ],
      date: [
        this.expense?.date ?? today,
        Validators.required,
      ],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.serverError = null;
    this.showOpenCashPanel = false;
    const value = this.form.getRawValue();

    const request$ = this.isEditMode
      ? this.expensesService.update(this.expense!.id, value)
      : this.expensesService.create(value);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.saved.emit();
      },
      error: (err) => {
        this.submitting = false;
        const errorCode: string = err?.error?.errorCode ?? '';
        const message: string   = err?.error?.message   ?? '';
        const isCajaCerrada =
          errorCode === 'CAJA_CERRADA' ||
          message.toLowerCase().includes('abrir la caja');
        if (isCajaCerrada) {
          this.showOpenCashPanel = true;
          this.serverError = null;
        } else {
          this.serverError = message || 'Ocurrió un error. Intente de nuevo.';
        }
      },
    });
  }

  irAbrirCaja(): void {
    this.router.navigate(['/app/cash-register']);
  }

  cancelarAperturaCaja(): void {
    this.showOpenCashPanel = false;
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.hasError(error));
  }
}
