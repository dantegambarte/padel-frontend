import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  BookingResponse,
  CreateBookingDto,
  UpdateBookingStatusDto,
  UpdateBookingDto,
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

  /** POST /bookings — crea una reserva nueva (atómico: cancha + productos + caja).
   *  Genera un UUID único por intento y lo envía como X-Idempotency-Key para que
   *  el backend detecte y rechace requests duplicados (red lenta, doble envío). */
  create(dto: CreateBookingDto): Observable<BookingResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<BookingResponse>(this.url, dto, { headers });
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

  /**
   * PATCH /bookings/:id — actualiza pago, items y/o estado de una reserva.
   */
  update(id: string, dto: UpdateBookingDto): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, dto);
  }

  /** DELETE /bookings/:id — cancela la reserva (solo admin). */
  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
