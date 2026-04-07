import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { User, CreateUserDto, UpdateUserDto } from '../models/user.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio de usuarios con caché en memoria para `findAll()`.
 *
 * Estrategia:
 * - La lista completa se cachea con `shareReplay(1)`.
 * - Cualquier mutación (create / update / toggleStatus / remove) invalida la caché.
 * - `clearCache()` es llamado también desde `AuthService.logout()` para
 *   evitar datos residuales al cambiar de usuario.
 * - `resetPassword()` no altera la lista, por lo que no invalida la caché.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly url = `${environment.apiUrl}/users`;

  private usersCache$: Observable<User[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Devuelve todos los usuarios del sistema. */
  findAll(): Observable<User[]> {
    if (!this.usersCache$) {
      this.usersCache$ = this.http.get<User[]>(this.url).pipe(shareReplay(1));
    }
    return this.usersCache$;
  }

  /** Invalida la caché de usuarios. */
  clearCache(): void {
    this.usersCache$ = null;
  }

  /**
   * Crea un nuevo usuario e invalida la caché.
   * @param dto - Datos del usuario a crear.
   */
  create(dto: CreateUserDto): Observable<User> {
    return this.http
      .post<User>(this.url, dto)
      .pipe(tap(() => this.clearCache()));
  }

  /**
   * Invierte el estado activo/inactivo del usuario indicado e invalida la caché.
   * @param id            - Identificador del usuario.
   * @param currentStatus - Estado actual; se envía el valor opuesto al backend.
   */
  toggleStatus(id: string, currentStatus: boolean): Observable<User> {
    return this.http
      .patch<User>(`${this.url}/${id}`, { isActive: !currentStatus })
      .pipe(tap(() => this.clearCache()));
  }

  /**
   * Actualiza parcialmente un usuario existente e invalida la caché.
   * @param id  - Identificador del usuario.
   * @param dto - Campos a modificar.
   */
  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http
      .patch<User>(`${this.url}/${id}`, dto)
      .pipe(tap(() => this.clearCache()));
  }

  /**
   * Elimina un usuario del sistema e invalida la caché.
   * @param id - Identificador del usuario.
   */
  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.url}/${id}`)
      .pipe(tap(() => this.clearCache()));
  }

  /**
   * Restablece la contraseña de un usuario (solo Admin).
   * La contraseña viaja por HTTPS y se hashea en el servidor — nunca se almacena en texto plano.
   * No altera la lista de usuarios, por lo que no invalida la caché.
   * @param id          - UUID del usuario al que se le resetea la contraseña.
   * @param newPassword - Nueva contraseña temporal definida por el administrador.
   */
  resetPassword(
    id: string,
    newPassword: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.url}/${id}/reset-password`,
      { newPassword },
    );
  }
}
