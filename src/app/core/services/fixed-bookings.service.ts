import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface FixedBooking {
  id: string;
  clientName: string;
  phoneNumber: string | null;
  dayOfWeek: number;
  hour: string;
  durationMinutes: number;
  courtId: string;
  court: { id: string; name: string };
  isActive: boolean;
  startDate: string;
  notes: string | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixedBookingDto {
  clientName: string;
  phoneNumber?: string;
  dayOfWeek: number;
  hour: string;
  durationMinutes?: number;
  courtId: string;
  startDate: string;
  notes?: string;
  teacherId?: string | null;
}

export interface UpdateFixedBookingDto extends Partial<CreateFixedBookingDto> {
  isActive?: boolean;
}

/**
 * Servicio de turnos fijos con caché en memoria para `findAll()`.
 *
 * Estrategia:
 * - La lista completa se cachea con `shareReplay(1)`.
 * - Cualquier mutación invalida la caché: create, update, deactivate,
 *   deleteFixedBookingCascade y generateNext (modifica ocurrencias vinculadas).
 * - `clearCache()` es llamado también desde `AuthService.logout()`.
 */
@Injectable({ providedIn: 'root' })
export class FixedBookingsService {
  private readonly url = `${environment.apiUrl}/fixed-bookings`;

  private fixedBookingsCache$: Observable<FixedBooking[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Devuelve todos los turnos fijos. Sirve desde caché si está disponible. */
  findAll(): Observable<FixedBooking[]> {
    if (!this.fixedBookingsCache$) {
      this.fixedBookingsCache$ = this.http
        .get<FixedBooking[]>(this.url)
        .pipe(shareReplay(1));
    }
    return this.fixedBookingsCache$;
  }

  findOne(id: string): Observable<FixedBooking> {
    return this.http.get<FixedBooking>(`${this.url}/${id}`);
  }

  /** Invalida la caché de turnos fijos. */
  clearCache(): void {
    this.fixedBookingsCache$ = null;
  }

  create(dto: CreateFixedBookingDto): Observable<FixedBooking> {
    return this.http.post<FixedBooking>(this.url, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  update(id: string, dto: UpdateFixedBookingDto): Observable<FixedBooking> {
    return this.http.patch<FixedBooking>(`${this.url}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }

  deleteFixedBookingCascade(id: string): Observable<{ deleted: number }> {
    return this.http.delete<{ deleted: number }>(`${this.url}/${id}/cascade`).pipe(
      tap(() => this.clearCache()),
    );
  }

  /** Genera las próximas ocurrencias de un turno fijo e invalida la caché. */
  generateNext(id: string): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.url}/${id}/generate`, {}).pipe(
      tap(() => this.clearCache()),
    );
  }
}
