import { Component, OnInit } from '@angular/core';
import { Expense } from '../../../core/models/expense.model';
import { ExpensesService } from '../../../core/services/expenses.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-expenses-list',
  templateUrl: './expenses-list.component.html',
})
export class ExpensesListComponent implements OnInit {
  expenses: Expense[] = [];
  loading = false;
  error: string | null = null;

  /** Controla visibilidad del modal de formulario. */
  showForm = false;
  /** Egreso seleccionado para editar (null = modo creación). */
  selectedExpense: Expense | null = null;

  /** Filtros de fecha (solo admin). */
  dateFrom = '';
  dateTo = '';

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  constructor(
    private expensesService: ExpensesService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    if (this.isAdmin) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      this.dateFrom = `${y}-${m}-01`;
      this.dateTo = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    }
    this.loadExpenses();
  }

  loadExpenses(): void {
    this.loading = true;
    this.error = null;
    const filters = this.isAdmin
      ? { from: this.dateFrom || undefined, to: this.dateTo || undefined }
      : undefined;

    this.expensesService.getAll(filters).subscribe({
      next: (data) => {
        this.expenses = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los egresos. Intente de nuevo.';
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.loadExpenses();
  }

  openCreateForm(): void {
    this.selectedExpense = null;
    this.showForm = true;
  }

  openEditForm(expense: Expense): void {
    this.selectedExpense = expense;
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.selectedExpense = null;
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
  get totalAmount(): number {
    return this.expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  }

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
