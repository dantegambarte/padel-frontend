import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { Expense } from '../../../core/models/expense.model';
import { ExpensesService } from '../../../core/services/expenses.service';
import { AuthService } from '../../../core/services/auth.service';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';

@Component({
    selector: 'app-expenses-list',
    templateUrl: './expenses-list.component.html',
    imports: [
    ReactiveFormsModule,
    FormsModule,
    NgClass,
    ExpenseFormComponent
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesListComponent implements OnInit {
  expenses = signal<Expense[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  /** Controla visibilidad del modal de formulario. */
  showForm = signal(false);
  /** Egreso seleccionado para editar (null = modo creación). */
  selectedExpense = signal<Expense | null>(null);

  /** Filtros de fecha (solo admin). */
  dateFrom = '';
  dateTo = '';

  isAdmin = this.authService.isAdminSignal;

  constructor(
    private expensesService: ExpensesService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    if (this.isAdmin()) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      this.dateFrom = `${y}-${m}-01`;
      this.dateTo = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    }
    this.loadExpenses();
  }

  loadExpenses(): void {
    this.loading.set(true);
    this.error.set(null);
    const filters = this.isAdmin()
      ? { from: this.dateFrom || undefined, to: this.dateTo || undefined }
      : undefined;

    this.expensesService.getAll(filters).subscribe({
      next: (data) => {
        this.expenses.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los egresos. Intente de nuevo.');
        this.loading.set(false);
      },
    });
  }

  onFilterChange(): void {
    this.loadExpenses();
  }

  openCreateForm(): void {
    this.selectedExpense.set(null);
    this.showForm.set(true);
  }

  openEditForm(expense: Expense): void {
    this.selectedExpense.set(expense);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.selectedExpense.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.loadExpenses();
  }

  deleteExpense(id: string): void {
    if (!confirm('¿Eliminar este egreso? Esta acción no se puede deshacer.')) {
      return;
    }
    this.expensesService.delete(id).subscribe({
      next: () => this.loadExpenses(),
      error: () => alert('Error al eliminar el egreso.'),
    });
  }

  /** Formatea un número como moneda local ($ argentina). */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  }

  /** Suma total de todos los egresos listados. */
  totalAmount = computed(() =>
    this.expenses().reduce((acc, e) => acc + Number(e.amount), 0),
  );

  /** Clases Tailwind por categoría para los badges de la lista. */
  categoryClass(category: string): string {
    const map: Record<string, string> = {
      Insumos: 'bg-blue-100 text-blue-700',
      Mantenimiento: 'bg-amber-100 text-amber-700',
      Sueldos: 'bg-violet-100 text-violet-700',
      Servicios: 'bg-teal-100 text-teal-700',
      Otro: 'bg-gray-100 text-gray-600',
    };
    return map[category] ?? 'bg-secondary text-secondary-foreground';
  }

  /** Nombre del responsable para mostrar en la columna de auditoría. */
  creatorName(expense: Expense): string {
    return expense.createdByUser?.fullName ?? 'Sistema';
  }

  /** True si el egreso fue creado por el admin (para badge visual). */
  isCreatedByAdmin(expense: Expense): boolean {
    return expense.createdByUser?.role === 'admin';
  }
}
