import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface RevenueDay {
  period: string;
  bookings: number;
  sales: number;
  total: number;
}

export interface PaymentBreakdown {
  cash: { total: number; percentage: number };
  transfer: { total: number; percentage: number };
  grandTotal: number;
}

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

export interface TransactionExport {
  date: string;
  time: string;
  type: string;
  concept: string;
  cash: number;
  transfer: number;
  total: number;
  createdBy: string;
}

export type GroupBy = 'day' | 'week' | 'month';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly url = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  /** Devuelve el resumen de KPIs del período actual para el Dashboard Admin. */
  getSummary(): Observable<ReportsSummaryResponse> {
    return this.http.get<ReportsSummaryResponse>(`${this.url}/summary`);
  }

  /**
   * Construye los `HttpParams` para los endpoints de reportes.
   * Si se pasa `date`, lo prioriza; si se pasa un rango, usa `dateFrom`/`dateTo`.
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

  /**
   * Devuelve la evolución de ingresos agrupada por período para los gráficos.
   * @param dateFrom - Fecha de inicio del rango (YYYY-MM-DD).
   * @param dateTo   - Fecha de fin del rango (YYYY-MM-DD).
   * @param groupBy  - Granularidad: 'day' | 'week' | 'month'.
   * @param date     - Día exacto opcional; tiene prioridad sobre el rango.
   */
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

  /**
   * Devuelve el desglose de pagos en efectivo y transferencia del período.
   * @param dateFrom - Fecha de inicio (YYYY-MM-DD).
   * @param dateTo   - Fecha de fin (YYYY-MM-DD).
   * @param date     - Día exacto opcional.
   */
  getPaymentMethods(
    dateFrom: string,
    dateTo: string,
    date?: string,
  ): Observable<PaymentBreakdown> {
    const params = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    return this.http.get<PaymentBreakdown>(`${this.url}/payment-methods`, {
      params,
    });
  }

  /**
   * Devuelve el top 20 de productos más vendidos en el período.
   * @param dateFrom - Fecha de inicio (YYYY-MM-DD).
   * @param dateTo   - Fecha de fin (YYYY-MM-DD).
   * @param date     - Día exacto opcional.
   */
  getProductsRanking(
    dateFrom: string,
    dateTo: string,
    date?: string,
  ): Observable<ProductRanking[]> {
    const params = date
      ? this.buildParams({ date })
      : this.buildParams({ dateFrom, dateTo });
    return this.http.get<ProductRanking[]>(`${this.url}/products-ranking`, {
      params,
    });
  }

  /**
   * Devuelve el detalle de transacciones del período en formato plano,
   * listo para ser convertido a Excel en el frontend.
   * @param dateFrom - Fecha de inicio (YYYY-MM-DD).
   * @param dateTo   - Fecha de fin (YYYY-MM-DD).
   * @param date     - Día exacto opcional.
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
