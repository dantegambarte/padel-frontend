import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { User, CreateUserDto } from '../models/user.model';
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

  toggleStatus(id: string, currentStatus: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/status`, { isActive: !currentStatus });
  }
}
