import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface RevenueDay {
  /** El backend formatea según groupBy. */
  period: string;
  bookings: number; // antes: alquileres
  sales: number; // antes: productos
  total: number;
}

export interface PaymentBreakdown {
  efectivo: { amount: number; percentage: number };
  transferencia: { amount: number; percentage: number };
}

/** Shape real del backend GET /reports/summary */
export interface ReportsSummaryResponse {
  totalRevenue: number;
  bookingsRevenue: number;
  salesRevenue: number;
  cashTotal: number;
  transferTotal: number;
  transactionCount: number;
}

export interface ProductRanking {
  rank: number;
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}

/** Shape real del backend GET /reports/transactions/export */
export interface TransactionExport {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: string; // 'booking' | 'sale'
  concept: string;
  cash: number;
  transfer: number;
  total: number;
  createdBy: string;
}

export type GroupBy = 'day' | 'week' | 'month';

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly url = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  /** GET /reports/summary — KPIs + resumen del día para Dashboard Admin. */
  getSummary(): Observable<ReportsSummaryResponse> {
    return this.http.get<ReportsSummaryResponse>(`${this.url}/summary`);
  }

  /**
   * Construye HttpParams para los endpoints de reportes.
   * Si se pasa `date`, envía sólo ese parámetro (el backend lo prioriza).
   * Si se pasan `dateFrom`/`dateTo`, envía el rango de período.
   */
  private buildParams(
    options: { date: string } | { dateFrom: string; dateTo: string },
  ): HttpParams {
    if ('date' in options) {
      return new HttpParams().set('date', options.date);
    }
    return new HttpParams()
      .set('dateFrom', options.dateFrom)
      .set('dateTo', options.dateTo);
  }

  /** GET /reports/revenue — evolución de ingresos para gráficos. */
  getRevenue(
    dateFrom: string,
    dateTo: string,
    groupBy: GroupBy = 'week',
    date?: string,
  ): Observable<RevenueDay[]> {
    const base = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    const params = base.set('groupBy', groupBy);
    return this.http.get<RevenueDay[]>(`${this.url}/revenue`, { params });
  }

  /** GET /reports/payment-methods — desglose efectivo/transferencia. */
  getPaymentMethods(
    dateFrom: string,
    dateTo: string,
    date?: string,
  ): Observable<PaymentBreakdown> {
    const params = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    return this.http.get<PaymentBreakdown>(`${this.url}/payment-methods`, { params });
  }

  /** GET /reports/products-ranking — top 20 productos más vendidos. */
  getProductsRanking(
    dateFrom: string,
    dateTo: string,
    date?: string,
  ): Observable<ProductRanking[]> {
    const params = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    return this.http.get<ProductRanking[]>(`${this.url}/products-ranking`, { params });
  }

  /**
   * GET /reports/transactions/export
   * Devuelve JSON plano apto para ser convertido a Excel en el frontend.
   */
  getTransactionsExport(
    dateFrom: string,
    dateTo: string,
    date?: string,
  ): Observable<TransactionExport[]> {
    const params = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    return this.http.get<TransactionExport[]>(
      `${this.url}/transactions/export`,
      { params },
    );
  }
}
