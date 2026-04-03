import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PricingShift,
  CreatePricingShiftDto,
  UpdatePricingShiftDto,
} from '../models/pricing-shift.model';

@Injectable({ providedIn: 'root' })
export class PricingShiftsService {
  private readonly url = `${environment.apiUrl}/pricing-shifts`;

  /** Caché de franjas activas. `null` = sin caché activa. */
  private shiftsCache$: Observable<PricingShift[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Todas las franjas (activas e inactivas). Solo Admin. */
  getAll(): Observable<PricingShift[]> {
    return this.http.get<PricingShift[]>(this.url);
  }

  /**
   * Solo franjas activas. Sirve desde caché si está disponible.
   * La caché se invalida automáticamente al crear, editar o eliminar una franja.
   */
  getActive(): Observable<PricingShift[]> {
    if (!this.shiftsCache$) {
      this.shiftsCache$ = this.http
        .get<PricingShift[]>(`${this.url}/active`)
        .pipe(shareReplay(1));
    }
    return this.shiftsCache$;
  }

  /** Invalida la caché para que la próxima llamada a `getActive()` consulte el servidor. */
  clearCache(): void {
    this.shiftsCache$ = null;
  }

  create(dto: CreatePricingShiftDto): Observable<PricingShift> {
    return this.http.post<PricingShift>(this.url, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  update(id: string, dto: UpdatePricingShiftDto): Observable<PricingShift> {
    return this.http.patch<PricingShift>(`${this.url}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }
}
