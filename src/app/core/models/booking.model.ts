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
  clientName: string;
  priceType: PriceType;
  durationMinutes: number;
  amountCash: number;
  amountTransfer: number;
  items: { productId: string; quantity: number }[];
  teacherId?: string | null;
}

/** Payload para transicionar el estado de una reserva. */
export interface UpdateBookingStatusDto {
  status: BookingStatus;
}

/** Payload para actualizar el pago, los ítems o el estado de una reserva existente. */
export interface UpdateBookingDto {
  status?: BookingStatus;
  clientName?: string;
  amountCash?: number;
  amountTransfer?: number;
  items?: { productId: string; quantity: number }[];
}

/** Payload compartido para Mover y Duplicar una reserva. */
export interface RescheduleBookingDto {
  courtId: string;
  date: string;
  hour: string;
}
