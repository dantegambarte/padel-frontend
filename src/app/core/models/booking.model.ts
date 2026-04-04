import { Court } from './court.model';
import { Product } from './product.model';

/** Posibles estados del ciclo de vida de una reserva. */
export type BookingStatus = 'booked' | 'playing' | 'completed' | 'cancelled';

/** Estrategia de precios aplicada a la reserva. */
export type PriceType = 'standard' | 'professor';

/** Línea de producto asociada a una reserva. */
export interface BookingItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Pick<Product, 'id' | 'name'>;
}

/** Registro de pago vinculado a una reserva. */
export interface BookingPayment {
  id: string;
  amountCash: number;
  amountTransfer: number;
}

/** Entidad completa de reserva devuelta por la API. */
export interface BookingResponse {
  id: string;
  court: Court;
  courtId: string;
  /** Fecha en formato ISO YYYY-MM-DD. */
  date: string;
  /** Hora en formato HH:MM. */
  hour: string;
  clientName: string;
  status: BookingStatus;
  priceType: PriceType;
  /**
   * Nombre de la franja horaria aplicada al crear la reserva (ej. 'Turno Tarde').
   * null para reservas históricas creadas antes de esta columna.
   */
  appliedShiftName: string | null;
  priceAmount: number;
  durationMinutes: number;
  items: BookingItem[];
  payment: BookingPayment | null;
  createdAt: string;
  /** ID del turno fijo que generó esta reserva. null si fue creada manualmente. */
  fixedBookingId: string | null;
  /** Datos del turno fijo asociado (solo phoneNumber necesario para el botón WA). */
  fixedBooking: { phoneNumber: string | null } | null;
  /** true cuando el cliente confirmó su asistencia al turno fijo. */
  isConfirmed: boolean;
}

/** Payload para crear una nueva reserva. */
export interface CreateBookingDto {
  courtId: string;
  date: string;
  hour: string;
  clientName?: string;
  priceType?: PriceType;
  durationMinutes?: number;
  amountCash?: number;
  amountTransfer?: number;
  items?: { productId: string; quantity: number }[];
  teacherId?: string | null;
  /** ID del turno origen para duplicación. Cuando se envía, clientName/priceType/durationMinutes/items se heredan. */
  sourceId?: string;
}

/** Payload para transicionar el estado de una reserva. */
export interface UpdateBookingStatusDto {
  status: BookingStatus;
}

/** Payload para actualizar el pago, los ítems, el estado, la posición o la confirmación de una reserva. */
export interface UpdateBookingDto {
  status?: BookingStatus;
  clientName?: string;
  amountCash?: number;
  amountTransfer?: number;
  items?: { productId: string; quantity: number }[];
  /** Mover turno: cancha destino */
  courtId?: string;
  /** Mover turno: fecha destino (YYYY-MM-DD) */
  date?: string;
  /** Mover turno: hora destino (HH:MM) */
  hour?: string;
  /** Confirmar asistencia de turno fijo */
  isConfirmed?: boolean;
}

/** Payload compartido para Mover y Duplicar una reserva. */
export interface RescheduleBookingDto {
  courtId: string;
  date: string;
  hour: string;
}
