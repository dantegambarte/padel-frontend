import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, CreateUserDto, UpdateUserDto } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly url = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /** Devuelve todos los usuarios del sistema. */
  findAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  /**
   * Crea un nuevo usuario.
   * @param dto - Datos del usuario a crear.
   */
  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.url, dto);
  }

  /**
   * Invierte el estado activo/inactivo del usuario indicado.
   * @param id            - Identificador del usuario.
   * @param currentStatus - Estado actual; se envía el valor opuesto al backend.
   */
  toggleStatus(id: string, currentStatus: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, {
      isActive: !currentStatus,
    });
  }

  /**
   * Actualiza parcialmente un usuario existente.
   * @param id  - Identificador del usuario.
   * @param dto - Campos a modificar.
   */
  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, dto);
  }

  /**
   * Elimina un usuario del sistema.
   * @param id - Identificador del usuario.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Restablece la contraseña de un usuario (solo Admin).
   * La contraseña viaja por HTTPS y se hashea en el servidor — nunca se almacena en texto plano.
   * @param id          - UUID del usuario al que se le resetea la contraseña.
   * @param newPassword - Nueva contraseña temporal definida por el administrador.
   */
  resetPassword(id: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.url}/${id}/reset-password`,
      { newPassword },
    );
  }
}
