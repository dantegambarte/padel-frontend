import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { Court, CreateCourtDto, UpdateCourtDto } from '../models/court.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio para gestionar canchas de padel mediante la API REST.
 *
 * `findAll()` usa caché en memoria (`shareReplay(1)`) para evitar
 * peticiones repetidas cuando los datos no cambian.
 * La caché se invalida automáticamente ante cualquier mutación (create/update/delete).
 */
@Injectable({ providedIn: 'root' })
export class CourtsService {
  private readonly url = `${environment.apiUrl}/courts`;

  /** Caché de la lista completa de canchas. `null` = sin caché activa. */
  private courtsCache$: Observable<Court[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Obtiene todas las canchas. Sirve desde caché si está disponible. */
  findAll(): Observable<Court[]> {
    if (!this.courtsCache$) {
      this.courtsCache$ = this.http.get<Court[]>(this.url).pipe(
        shareReplay(1),
      );
    }
    return this.courtsCache$;
  }

  /** Invalida la caché para que la próxima llamada a `findAll()` consulte el servidor. */
  clearCache(): void {
    this.courtsCache$ = null;
  }

  /**
   * Crea una nueva cancha e invalida la caché.
   * @param dto - Payload de creación de la cancha.
   */
  create(dto: CreateCourtDto): Observable<Court> {
    return this.http.post<Court>(this.url, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  /**
   * Actualiza parcialmente una cancha existente e invalida la caché.
   * @param id  - Identificador de la cancha.
   * @param dto - Payload de actualización parcial.
   */
  update(id: string, dto: UpdateCourtDto): Observable<Court> {
    return this.http.patch<Court>(`${this.url}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  /**
   * Actualiza los precios de múltiples canchas en una sola petición e invalida la caché.
   */
  bulkUpdatePrices(payload: { courtIds: string[]; price30: number; price60: number; price90: number; price120: number }): Observable<Court[]> {
    return this.http.patch<Court[]>(`${this.url}/bulk-prices`, payload).pipe(
      tap(() => this.clearCache()),
    );
  }

  /** Elimina una cancha por ID e invalida la caché. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }
}
