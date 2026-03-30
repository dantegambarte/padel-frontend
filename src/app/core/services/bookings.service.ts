import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  BookingResponse,
  CreateBookingDto,
  UpdateBookingStatusDto,
  UpdateBookingDto,
  RescheduleBookingDto,
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

  /**
   * Mueve una reserva a otro slot (cancha / fecha / hora).
   * El backend verifica disponibilidad del destino (anti-overbooking).
   * @param id  - ID de la reserva a mover.
   * @param dto - Cancha, fecha y hora de destino.
   */
  move(id: string, dto: RescheduleBookingDto): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, dto);
  }

  /**
   * Duplica una reserva en otro slot.
   * El nuevo turno hereda cliente, precio y duración; el pago empieza en $0.
   * @param id  - ID de la reserva original.
   * @param dto - Cancha, fecha y hora de destino.
   */
  duplicate(id: string, dto: RescheduleBookingDto): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(this.url, { ...dto, sourceId: id });
  }

  /**
   * Confirma la asistencia del cliente a un turno fijo (isConfirmed = true).
   * @param id - ID de la reserva.
   */
  confirm(id: string): Observable<BookingResponse> {
    return this.http.patch<BookingResponse>(`${this.url}/${id}`, { isConfirmed: true });
  }
}
