import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { Teacher, CreateTeacherDto, UpdateTeacherDto } from '../models/teacher.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio de profesores con caché en memoria para `findAll()` y `findAllIncludingInactive()`.
 *
 * Estrategia:
 * - Ambas listas se cachean con `shareReplay(1)`.
 * - Cualquier mutación (create / update / deactivate) invalida ambas cachés.
 * - `clearCache()` es llamado también desde `AuthService.logout()` para
 *   evitar datos residuales al cambiar de usuario.
 */
@Injectable({ providedIn: 'root' })
export class TeachersService {
  private readonly base = `${environment.apiUrl}/teachers`;

  private allCache$: Observable<Teacher[]> | null = null;
  private allIncludingInactiveCache$: Observable<Teacher[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Lista solo profesores activos (para selects en agenda, etc.). */
  findAll(): Observable<Teacher[]> {
    if (!this.allCache$) {
      this.allCache$ = this.http.get<Teacher[]>(this.base).pipe(shareReplay(1));
    }
    return this.allCache$;
  }

  /** Lista todos los profesores incluyendo inactivos (panel admin). */
  findAllIncludingInactive(): Observable<Teacher[]> {
    if (!this.allIncludingInactiveCache$) {
      this.allIncludingInactiveCache$ = this.http
        .get<Teacher[]>(`${this.base}/all`)
        .pipe(shareReplay(1));
    }
    return this.allIncludingInactiveCache$;
  }

  /** Invalida ambas cachés de profesores. */
  clearCache(): void {
    this.allCache$ = null;
    this.allIncludingInactiveCache$ = null;
  }

  create(dto: CreateTeacherDto): Observable<Teacher> {
    return this.http.post<Teacher>(this.base, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  update(id: string, dto: UpdateTeacherDto): Observable<Teacher> {
    return this.http.patch<Teacher>(`${this.base}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }
}
