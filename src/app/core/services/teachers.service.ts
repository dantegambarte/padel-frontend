import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import {
  Teacher,
  CreateTeacherDto,
  UpdateTeacherDto,
  TeacherReport,
} from '../models/teacher.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio de profesores con caché en memoria.
 *
 * Estrategia:
 * - `findAll(false)` (activos) y `findAll(true)` (todos) se cachean por separado
 *   con `shareReplay(1)` para que cada llamada concurrent reciba la misma respuesta.
 * - Cualquier mutación (create / update / deactivate) invalida ambas cachés.
 * - `clearCache()` es llamado también desde `AuthService.logout()`.
 *
 * Endpoint unificado: `GET /teachers?includeInactive=true` (RESTful, sin sub-recursos `/all`).
 */
@Injectable({ providedIn: 'root' })
export class TeachersService {
  private readonly base = `${environment.apiUrl}/teachers`;

  private activeCache$: Observable<Teacher[]> | null = null;
  private allCache$: Observable<Teacher[]> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la lista de profesores.
   * @param includeInactive `false` (por defecto) → solo activos.
   *                        `true` → activos + inactivos (requiere rol admin).
   */
  findAll(includeInactive = false): Observable<Teacher[]> {
    if (includeInactive) {
      if (!this.allCache$) {
        const params = new HttpParams().set('includeInactive', 'true');
        this.allCache$ = this.http
          .get<Teacher[]>(this.base, { params })
          .pipe(shareReplay(1));
      }
      return this.allCache$;
    }

    if (!this.activeCache$) {
      this.activeCache$ = this.http
        .get<Teacher[]>(this.base)
        .pipe(shareReplay(1));
    }
    return this.activeCache$;
  }

  /** Invalida ambas cachés de profesores. */
  clearCache(): void {
    this.activeCache$ = null;
    this.allCache$ = null;
  }

  /** Crea un nuevo profesor e invalida la caché. */
  create(dto: CreateTeacherDto): Observable<Teacher> {
    return this.http
      .post<Teacher>(this.base, dto)
      .pipe(tap(() => this.clearCache()));
  }

  /** Actualiza los datos de un profesor e invalida la caché. */
  update(id: string, dto: UpdateTeacherDto): Observable<Teacher> {
    return this.http
      .patch<Teacher>(`${this.base}/${id}`, dto)
      .pipe(tap(() => this.clearCache()));
  }

  /** Desactiva un profesor (soft-delete) e invalida la caché. */
  deactivate(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/${id}`)
      .pipe(tap(() => this.clearCache()));
  }

  /** Obtiene el reporte de liquidación de un profesor en un rango de fechas. */
  getReport(
    id: string,
    startDate: string,
    endDate: string,
  ): Observable<TeacherReport> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<TeacherReport>(`${this.base}/${id}/report`, {
      params,
    });
  }
}
