import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  hasDeposit: boolean;
  isActive: boolean;
  startDate: string;
  notes: string | null;
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
  hasDeposit?: boolean;
  startDate: string;
  notes?: string;
}

export interface UpdateFixedBookingDto extends Partial<CreateFixedBookingDto> {
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FixedBookingsService {
  private readonly url = `${environment.apiUrl}/fixed-bookings`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<FixedBooking[]> {
    return this.http.get<FixedBooking[]>(this.url);
  }

  findOne(id: string): Observable<FixedBooking> {
    return this.http.get<FixedBooking>(`${this.url}/${id}`);
  }

  create(dto: CreateFixedBookingDto): Observable<FixedBooking> {
    return this.http.post<FixedBooking>(this.url, dto);
  }

  update(id: string, dto: UpdateFixedBookingDto): Observable<FixedBooking> {
    return this.http.patch<FixedBooking>(`${this.url}/${id}`, dto);
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  generateNext(id: string): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.url}/${id}/generate`, {});
  }
}
