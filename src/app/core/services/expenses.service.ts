import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateExpenseDto,
  Expense,
  UpdateExpenseDto,
} from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly apiUrl = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  getAll(filters?: { from?: string; to?: string }): Observable<Expense[]> {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to)   params = params.set('to',   filters.to);
    return this.http.get<Expense[]>(this.apiUrl, { params });
  }

  getOne(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateExpenseDto): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateExpenseDto): Observable<Expense> {
    return this.http.patch<Expense>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
