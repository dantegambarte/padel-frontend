import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface RevenueDay {
  /** El backend formatea según groupBy. */
  period:   string;
  bookings: number;  // antes: alquileres
  sales:    number;  // antes: productos
  total:    number;
}

export interface PaymentBreakdown {
  efectivo:      { amount: number; percentage: number };
  transferencia: { amount: number; percentage: number };
}

/** Shape real del backend GET /reports/summary */
export interface ReportsSummaryResponse {
  totalRevenue:     number;
  bookingsRevenue:  number;
  salesRevenue:     number;
  cashTotal:        number;
  transferTotal:    number;
  transactionCount: number;
}

export interface ProductRanking {
  productId: string;
  name:      string;
  unidades:  number;
  total:     number;
}

/** Shape real del backend GET /reports/transactions/export */
export interface TransactionExport {
  date:      string;   // YYYY-MM-DD
  time:      string;   // HH:MM
  type:      string;   // 'booking' | 'sale'
  concept:   string;
  cash:      number;
  transfer:  number;
  total:     number;
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

  /** GET /reports/revenue?dateFrom&dateTo&groupBy — evolución de ingresos para gráficos. */
  getRevenue(dateFrom: string, dateTo: string, groupBy: GroupBy = 'week'): Observable<RevenueDay[]> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo',   dateTo)
      .set('groupBy',  groupBy);
    return this.http.get<RevenueDay[]>(`${this.url}/revenue`, { params });
  }

  /** GET /reports/payment-methods?dateFrom&dateTo — desglose efectivo/transferencia. */
  getPaymentMethods(dateFrom: string, dateTo: string): Observable<PaymentBreakdown> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo',   dateTo);
    return this.http.get<PaymentBreakdown>(`${this.url}/payment-methods`, { params });
  }

  /** GET /reports/products-ranking?dateFrom&dateTo — top 20 productos más vendidos. */
  getProductsRanking(dateFrom: string, dateTo: string): Observable<ProductRanking[]> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo',   dateTo);
    return this.http.get<ProductRanking[]>(`${this.url}/products-ranking`, { params });
  }

  /**
   * GET /reports/transactions/export?dateFrom&dateTo
   * Devuelve JSON plano apto para ser convertido a CSV en el frontend.
   * El frontend aplica el BOM UTF-8 para compatibilidad con Excel en Windows.
   */
  getTransactionsExport(dateFrom: string, dateTo: string): Observable<TransactionExport[]> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo',   dateTo);
    return this.http.get<TransactionExport[]>(`${this.url}/transactions/export`, { params });
  }
}
