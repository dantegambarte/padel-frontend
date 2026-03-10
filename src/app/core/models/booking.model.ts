import { Court } from './court.model';
import { Product } from './product.model';

export type BookingStatus = 'booked' | 'playing' | 'completed' | 'cancelled';
export type PriceType = 'standard' | 'professor';

export interface BookingItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: Pick<Product, 'id' | 'name'>;
}

export interface BookingPayment {
  id: string;
  amountCash: number;
  amountTransfer: number;
}

export interface BookingResponse {
  id: string;
  court: Court;
  courtId: string;
  date: string;       // YYYY-MM-DD
  hour: string;       // HH:MM
  clientName: string;
  status: BookingStatus;
  priceType: PriceType;
  priceAmount: number;
  items: BookingItem[];
  payment: BookingPayment | null;
  createdAt: string;
}

export interface CreateBookingDto {
  courtId: string;
  date: string;
  hour: string;
  clientName: string;
  priceType: PriceType;
  amountCash: number;
  amountTransfer: number;
  items: { productId: string; quantity: number }[];
}

export interface UpdateBookingStatusDto {
  status: BookingStatus;
}
