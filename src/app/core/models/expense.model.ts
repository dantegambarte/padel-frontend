/** Métodos de pago de un egreso (deben coincidir con el enum del backend). */
export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';

/** Categorías de egreso (deben coincidir con el enum del backend). */
export type ExpenseCategory =
  | 'Insumos'
  | 'Mantenimiento'
  | 'Sueldos'
  | 'Servicios'
  | 'Otro';

/** Entidad Egreso devuelta por el backend. */
export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  date: string;
  cashSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO para crear un egreso. */
export interface CreateExpenseDto {
  amount: number;
  description: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  date: string;
}

/** DTO para editar parcialmente un egreso. */
export type UpdateExpenseDto = Partial<CreateExpenseDto>;
