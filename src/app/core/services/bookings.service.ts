import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  BookingResponse,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from '../models/booking.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly url = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

  /** GET /bookings?date=YYYY-MM-DD — alimenta la grilla de la Agenda. */
  findByDate(date: string): Observable<BookingResponse[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<BookingResponse[]>(this.url, { params });
  }

  /** POST /bookings — crea una reserva nueva (atómico: cancha + productos + caja). */
  create(dto: CreateBookingDto): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(this.url, dto);
  }

  /**
   * PATCH /bookings/:id/status — transiciona el estado de la reserva.
   * Transiciones válidas: booked → playing → completed, any → cancelled (admin).
   */
  updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
  ): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, dto);
  }

  /** DELETE /bookings/:id — cancela la reserva (solo admin). */
  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
