import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';

import { Court, CreateCourtDto, UpdateCourtDto } from '../models/court.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio de Canchas — fuente de verdad reactiva para toda la app.
 *
 * Expone `courts$` como Observable público. Cualquier componente que se suscriba
 * recibe la lista actualizada automáticamente cuando otro componente la muta,
 * sin necesidad de recargar la página.
 */
@Injectable({ providedIn: 'root' })
export class CourtsService {
  private readonly url = `${environment.apiUrl}/courts`;

  private readonly _courts$ = new BehaviorSubject<Court[]>([]);

  /** Observable público de solo lectura. Todos los componentes consumen este stream. */
  readonly courts$: Observable<Court[]> = this._courts$.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Limpia el estado local. Se llama al hacer logout para que la próxima
   * sesión cargue datos frescos sin residuos del usuario anterior.
   */
  clearCache(): void {
    this._courts$.next([]);
  }

  /** Consulta el servidor y actualiza el BehaviorSubject. */
  loadCourts(): void {
    this.http.get<Court[]>(this.url).subscribe({
      next: (courts) => this._courts$.next(courts),
    });
  }

  /**
   * Obtiene la lista de canchas como Observable que completa (apto para forkJoin).
   * Si el subject ya tiene datos los emite de inmediato sin ir al servidor.
   * Si está vacío, consulta el servidor, actualiza el subject y completa.
   */
  findAll(): Observable<Court[]> {
    if (this._courts$.value.length > 0) {
      return of(this._courts$.value);
    }
    return this.http.get<Court[]>(this.url).pipe(
      tap((courts) => this._courts$.next(courts)),
    );
  }

  /** Crea una nueva cancha y la inserta en el estado local al confirmar. */
  create(dto: CreateCourtDto): Observable<Court> {
    return this.http.post<Court>(this.url, dto).pipe(
      tap((created) => {
        const updated = [...this._courts$.value, created].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        this._courts$.next(updated);
      }),
    );
  }

  /** Actualiza una cancha existente y refleja el cambio en el estado local. */
  update(id: string, dto: UpdateCourtDto): Observable<Court> {
    return this.http.patch<Court>(`${this.url}/${id}`, dto).pipe(
      tap((updated) => {
        const courts = this._courts$.value.map((c) =>
          c.id === updated.id ? updated : c,
        );
        this._courts$.next(courts);
      }),
    );
  }

  /**
   * Cambia el estado activo/inactivo de una cancha.
   * Actualización optimista: modifica el estado local de inmediato y
   * revierte si el servidor responde con error.
   */
  toggleStatus(id: string, isActive: boolean): Observable<Court> {
    const previous = this._courts$.value;

    // Actualización optimista
    this._courts$.next(
      previous.map((c) => (c.id === id ? { ...c, isActive } : c)),
    );

    return this.http.patch<Court>(`${this.url}/${id}`, { isActive }).pipe(
      tap((updated) => {
        // Confirmar con la respuesta real del servidor
        this._courts$.next(
          this._courts$.value.map((c) => (c.id === updated.id ? updated : c)),
        );
      }),
    );
  }

  /** Elimina una cancha y la quita del estado local al confirmar. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => {
        this._courts$.next(this._courts$.value.filter((c) => c.id !== id));
      }),
    );
  }
}
