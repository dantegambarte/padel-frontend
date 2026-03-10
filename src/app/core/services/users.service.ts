import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, CreateUserDto, UpdateUserDto } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly url = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.url, dto);
  }

  /** Activa o desactiva un usuario. El backend expone PATCH /:id con { isActive }. */
  toggleStatus(id: string, currentStatus: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, {
      isActive: !currentStatus,
    });
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
