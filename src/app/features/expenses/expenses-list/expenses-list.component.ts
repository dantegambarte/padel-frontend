import { Component, OnInit } from '@angular/core';
import { Expense } from '../../../core/models/expense.model';
import { ExpensesService } from '../../../core/services/expenses.service';

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

  constructor(private expensesService: ExpensesService) {}

  ngOnInit(): void {
    this.loadExpenses();
  }

  loadExpenses(): void {
    this.loading = true;
    this.error = null;
    this.expensesService.getAll().subscribe({
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
      'Insumos':       'bg-blue-100 text-blue-700',
      'Mantenimiento': 'bg-amber-100 text-amber-700',
      'Sueldos':       'bg-violet-100 text-violet-700',
      'Servicios':     'bg-teal-100 text-teal-700',
      'Otro':          'bg-gray-100 text-gray-600',
    };
    return map[category] ?? 'bg-secondary text-secondary-foreground';
  }
}
