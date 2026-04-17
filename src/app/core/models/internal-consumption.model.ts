import { Product } from './product.model';

export type InternalConsumptionStatus =
  | 'staff_consumption'
  | 'pending_payment'
  | 'paid';

export type ConsumerType = 'staff' | 'teacher';

export interface InternalConsumption {
  id: string;
  productId: string;
  product: { id: string; name: string; icon: string };
  quantity: number;
  consumerType: ConsumerType;
  userId: string | null;
  user: { id: string; fullName: string } | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string; phoneNumber: string | null } | null;
  status: InternalConsumptionStatus;
  notes: string | null;
  unitCostPrice: number;
  date: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInternalConsumptionDto {
  productId: string;
  quantity: number;
  consumerType: ConsumerType;
  userId?: string;
  teacherId?: string;
  notes?: string;
  date: string;
}

export type PaymentMethod = 'cash' | 'transfer';

export interface SettleTeacherDebtDto {
  teacherId: string;
  paymentMethod: PaymentMethod;
  consumptionIds?: string[];
  notes?: string;
}

export interface TeacherDebtSummary {
  teacherId: string;
  totalItems: number;
  totalCost: number;
}

export interface InternalConsumptionFilters {
  status?: InternalConsumptionStatus;
  consumerType?: ConsumerType;
  teacherId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RowState {
  search: string;
  selectedName: string;
  filtered: Product[];
  showDropdown: boolean;
}

export interface EnrichedDebtSummary extends TeacherDebtSummary {
  teacherName: string;
  phoneNumber: string | null;
}
