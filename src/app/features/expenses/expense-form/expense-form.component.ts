import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import {
  Expense,
  ExpenseCategory,
  FundSource,
  PaymentMethod,
} from '../../../core/models/expense.model';
import { ExpensesService } from '../../../core/services/expenses.service';
import { DraftService } from '../../../core/services/draft.service';
import { AuthService } from '../../../core/services/auth.service';
import { ModalScrollLockDirective } from '../../../shared/modal-scroll-lock.directive';
import { NgIf, NgFor } from '@angular/common';
import { DisableScrollDirective } from '../../../shared/directives/disable-scroll.directive';

@Component({
    selector: 'app-expense-form',
    templateUrl: './expense-form.component.html',
    imports: [
        ModalScrollLockDirective,
        NgIf,
        ReactiveFormsModule,
        DisableScrollDirective,
        NgFor,
    ],
})
export class ExpenseFormComponent implements OnInit, OnDestroy {
  /** Si se pasa un Expense existente, el formulario trabaja en modo edición. */
  @Input() expense: Expense | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  submitting = false;
  serverError: string | null = null;

  showOpenCashPanel = false;
  /** true cuando hay un borrador encontrado esperando confirmación del usuario. */
  draftRestored = false;
  private pendingDraft: Record<string, unknown> | null = null;

  private readonly DRAFT_KEY = 'draft_expense';
  private sub = new Subscription();

  /** Categorías exclusivas de admin que los empleados no pueden seleccionar. */
  private readonly ADMIN_ONLY_CATEGORIES: ExpenseCategory[] = ['Sueldos'];

  private readonly ALL_CATEGORIES: ExpenseCategory[] = [
    'Insumos',
    'Mantenimiento',
    'Sueldos',
    'Servicios',
    'Otro',
  ];

  get categories(): ExpenseCategory[] {
    if (this.authService.isAdmin) return this.ALL_CATEGORIES;
    return this.ALL_CATEGORIES.filter(
      (c) => !this.ADMIN_ONLY_CATEGORIES.includes(c),
    );
  }

  readonly paymentMethods: PaymentMethod[] = [
    'Efectivo',
    'Transferencia',
    'Tarjeta',
    'Otro',
  ];

  readonly fundSources: { value: FundSource; label: string }[] = [
    { value: 'cash_register', label: 'Caja Diaria' },
    { value: 'general_funds', label: 'Fondos del Complejo' },
  ];

  /** True cuando admin elige fondos generales → caja no requerida. */
  get isGeneralFunds(): boolean {
    return (
      this.authService.isAdmin &&
      this.form?.get('fundSource')?.value === 'general_funds'
    );
  }

  get isEditMode(): boolean {
    return !!this.expense;
  }

  constructor(
    private fb: FormBuilder,
    private expensesService: ExpensesService,
    private router: Router,
    private draftService: DraftService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    const d = new Date();
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
      category: [this.expense?.category ?? 'Otro', Validators.required],
      paymentMethod: [
        this.expense?.paymentMethod ?? 'Efectivo',
        Validators.required,
      ],
      date: [this.expense?.date ?? today, Validators.required],
      fundSource: ['cash_register'],
    });

    if (!this.isEditMode) {
      const draft = this.draftService.getDraft<Record<string, unknown>>(
        this.DRAFT_KEY,
      );
      if (draft) {
        this.pendingDraft = draft;
        this.draftRestored = true;
      }

      this.sub.add(
        this.form.valueChanges.pipe(debounceTime(500)).subscribe((value) => {
          this.draftService.saveDraft(this.DRAFT_KEY, value);
        }),
      );
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Aplica el borrador guardado al formulario y oculta el banner de restauración. */
  applyDraft(): void {
    if (this.pendingDraft) {
      this.form.patchValue(this.pendingDraft);
      this.pendingDraft = null;
    }
    this.draftRestored = false;
  }

  /** Descarta el borrador guardado sin aplicarlo al formulario. */
  dismissDraftBadge(): void {
    this.draftService.clearDraft(this.DRAFT_KEY);
    this.pendingDraft = null;
    this.draftRestored = false;
  }

  /** Valida el formulario y envía la creación o actualización del egreso. Detecta error de caja cerrada. */
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
        if (!this.isEditMode) {
          this.draftService.clearDraft(this.DRAFT_KEY);
        }
        this.saved.emit();
      },
      error: (err) => {
        this.submitting = false;
        const errorCode: string = err?.error?.errorCode ?? '';
        const message: string = err?.error?.message ?? '';
        const isCajaCerrada =
          errorCode === 'CAJA_CERRADA' ||
          message.toLowerCase().includes('abrir la caja');
        if (isCajaCerrada && !this.isGeneralFunds) {
          this.showOpenCashPanel = true;
          this.serverError = null;
        } else {
          this.serverError = message || 'Ocurrió un error. Intente de nuevo.';
        }
      },
    });
  }

  /** Navega a Cierre de Caja cuando el egreso fue rechazado por caja cerrada. */
  irAbrirCaja(): void {
    this.router.navigate(['/app/cash-register']);
  }

  /** Oculta el panel de apertura de caja sin navegar. */
  cancelarAperturaCaja(): void {
    this.showOpenCashPanel = false;
  }

  /** Emite el evento de cancelación para cerrar el modal desde el padre. */
  onCancel(): void {
    this.cancelled.emit();
  }

  /** True si el campo fue tocado y tiene el error indicado. */
  hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.hasError(error));
  }
}
