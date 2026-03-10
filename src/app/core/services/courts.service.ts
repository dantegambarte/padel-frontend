import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Court } from '../models/court.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CourtsService {
  private readonly url = `${environment.apiUrl}/courts`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<Court[]> {
    return this.http.get<Court[]>(this.url);
  }
}
