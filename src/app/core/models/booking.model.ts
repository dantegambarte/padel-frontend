import { Court } from './court.model';
import { Product } from './product.model';

/** Possible lifecycle states of a booking. */
export type BookingStatus = 'booked' | 'playing' | 'completed' | 'cancelled';

/** Pricing strategy applied to the booking. */
export type PriceType = 'standard' | 'professor';

/** A single product line associated with a booking. */
export interface BookingItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Pick<Product, 'id' | 'name'>;
}

/** Payment record linked to a booking. */
export interface BookingPayment {
  id: string;
  amountCash: number;
  amountTransfer: number;
}

/** Full booking entity returned by the API. */
export interface BookingResponse {
  id: string;
  court: Court;
  courtId: string;
  /** ISO date string in YYYY-MM-DD format. */
  date: string;
  /** Time string in HH:MM format. */
  hour: string;
  clientName: string;
  status: BookingStatus;
  priceType: PriceType;
  priceAmount: number;
  durationMinutes: number;
  items: BookingItem[];
  payment: BookingPayment | null;
  createdAt: string;
}

/** Payload for creating a new booking. */
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
}

/** Payload for transitioning a booking's status. */
export interface UpdateBookingStatusDto {
  status: BookingStatus;
}

/** Payload for updating payment details, items, or status of an existing booking. */
export interface UpdateBookingDto {
  status?: BookingStatus;
  clientName?: string;
  amountCash?: number;
  amountTransfer?: number;
  items?: { productId: string; quantity: number }[];
}
