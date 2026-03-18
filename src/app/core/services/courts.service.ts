import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Court, CreateCourtDto, UpdateCourtDto } from '../models/court.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio para gestionar canchas de pádel mediante la API REST.
 */
@Injectable({ providedIn: 'root' })
export class CourtsService {
  private readonly url = `${environment.apiUrl}/courts`;

  constructor(private http: HttpClient) {}

  /** Obtiene todas las canchas. */
  findAll(): Observable<Court[]> {
    return this.http.get<Court[]>(this.url);
  }

  /**
   * Crea una nueva cancha.
   * @param dto - Payload de creación de la cancha.
   */
  create(dto: CreateCourtDto): Observable<Court> {
    return this.http.post<Court>(this.url, dto);
  }

  /**
   * Actualiza parcialmente una cancha existente.
   * @param id  - Identificador de la cancha.
   * @param dto - Payload de actualización parcial.
   */
  update(id: string, dto: UpdateCourtDto): Observable<Court> {
    return this.http.patch<Court>(`${this.url}/${id}`, dto);
  }

  /** Elimina una cancha por ID. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
