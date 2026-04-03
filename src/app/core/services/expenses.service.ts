import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateExpenseDto,
  Expense,
  UpdateExpenseDto,
} from '../models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly apiUrl = `${environment.apiUrl}/expenses`;

  private expensesCache$: Observable<Expense[]> | null = null;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Expense[]> {
    if (!this.expensesCache$) {
      this.expensesCache$ = this.http.get<Expense[]>(this.apiUrl).pipe(
        shareReplay(1),
      );
    }
    return this.expensesCache$;
  }

  getOne(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateExpenseDto): Observable<Expense> {
    return this.http.post<Expense>(this.apiUrl, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  update(id: string, dto: UpdateExpenseDto): Observable<Expense> {
    return this.http.patch<Expense>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }

  clearCache(): void {
    this.expensesCache$ = null;
  }
}
