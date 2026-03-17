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

/**
 * Servicio para gestionar reservas de canchas mediante la API REST.
 */
@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly url = `${environment.apiUrl}/bookings`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todas las reservas para una fecha dada.
   * @param date - Cadena de fecha en formato YYYY-MM-DD.
   */
  findByDate(date: string): Observable<BookingResponse[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<BookingResponse[]>(this.url, { params });
  }

  /**
   * Crea una nueva reserva de forma atómica (turno de cancha + productos + caja).
   * Envía un header `X-Idempotency-Key` único para que el backend detecte
   * y rechace envíos duplicados causados por redes lentas o doble-click.
   * @param dto - Payload de creación de la reserva.
   */
  create(dto: CreateBookingDto): Observable<BookingResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<BookingResponse>(this.url, dto, { headers });
  }

  /**
   * Transiciona el estado de una reserva existente.
   * Transiciones válidas: `booked → playing → completed`, cualquiera → `cancelled` (solo admin).
   * @param id  - Identificador de la reserva.
   * @param dto - Payload de transición de estado.
   */
  updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
  ): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, dto);
  }

  /**
   * Actualiza montos de pago, ítems de productos o estado de una reserva existente.
   * @param id  - Identificador de la reserva.
   * @param dto - Payload de actualización parcial.
   */
  update(id: string, dto: UpdateBookingDto): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, dto);
  }

  /**
   * Cancela una reserva (solo admin).
   * @param id - Identificador de la reserva.
   */
  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
