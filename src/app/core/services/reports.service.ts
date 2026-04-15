import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface RevenueDay {
  period: string;
  bookings: number;
  sales: number;
  total: number;
  expenses: number;
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
  totalExpenses: number;
  netProfit: number;
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
  referenceId: string | null;
}

export type GroupBy = 'day' | 'week' | 'month';

export interface ExpenseReportItem {
  id: string;
  date: string;
  description: string;
  category: string;
  paymentMethod: string;
  amount: number;
  createdByUser: { id: string; fullName: string; role: string } | null;
}

export interface ExpensesReport {
  items: ExpenseReportItem[];
  totalAmount: number;
  byCategory: { category: string; total: number }[];
  byPaymentMethod: { method: string; total: number }[];
}

export interface TodayKpis {
  totalRevenue: number;
  cashTotal: number;
  transferTotal: number;
  completedBookings: number;
  liveBookings: number;
  canceledBookings: number;
  totalOperations: number;
  totalSlots: number;
  occupationRate: number;
  cantinaItemsSold: number;
  cantinaRevenue: number;
  courtsRevenue: number;
  topProduct: { name: string; quantity: number } | null;
  averageTicket: number;
}

export interface DailyRevenue {
  date: string;
  cash: number;
  transfer: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly url = `${environment.apiUrl}/reports`;

  /**
   * Cachés con TTL para los endpoints de Dashboard.
   * Deduplicación de llamadas simultáneas (DashboardAdmin monta varios widgets
   * en paralelo que llaman al mismo endpoint en el mismo ciclo).
   *
   * TTL 30 s para KPIs del día (cifras en movimiento continuo).
   * TTL 60 s para los últimos 7 días (datos históricos, cambian con menor frecuencia).
   */
  private kpisCache$: Observable<TodayKpis> | null = null;
  private last7DaysCache$: Observable<DailyRevenue[]> | null = null;
  private readonly KPIS_TTL_MS = 30_000;
  private readonly LAST7DAYS_TTL_MS = 60_000;

  constructor(private http: HttpClient) {}

  /** KPIs de la sesión de caja activa para el Dashboard Admin (turnos, ingresos, ocupación, productos). */
  getTodayKpis(date?: string): Observable<TodayKpis> {
    if (this.kpisCache$) return this.kpisCache$;
    const params = date ? new HttpParams().set('date', date) : undefined;
    this.kpisCache$ = this.http
      .get<TodayKpis>(`${this.url}/kpis`, { params })
      .pipe(shareReplay(1));
    setTimeout(() => {
      this.kpisCache$ = null;
    }, this.KPIS_TTL_MS);
    return this.kpisCache$;
  }

  /** Ingresos de los últimos N días desglosados en Efectivo y Transferencia. */
  getLast7DaysRevenue(days = 7): Observable<DailyRevenue[]> {
    if (this.last7DaysCache$) return this.last7DaysCache$;
    const params = new HttpParams().set('days', days.toString());
    this.last7DaysCache$ = this.http
      .get<DailyRevenue[]>(`${this.url}/revenue/trend`, { params })
      .pipe(shareReplay(1));
    setTimeout(() => {
      this.last7DaysCache$ = null;
    }, this.LAST7DAYS_TTL_MS);
    return this.last7DaysCache$;
  }

  /** Invalida ambas cachés de dashboard (útil tras logout o navegación forzada). */
  clearCache(): void {
    this.kpisCache$ = null;
    this.last7DaysCache$ = null;
  }

  /** Devuelve el resumen de KPIs del período (ingresos, egresos, ganancia neta). */
  getSummary(
    dateFrom?: string,
    dateTo?: string,
  ): Observable<ReportsSummaryResponse> {
    const params =
      dateFrom && dateTo
        ? new HttpParams().set('dateFrom', dateFrom).set('dateTo', dateTo)
        : undefined;
    return this.http.get<ReportsSummaryResponse>(`${this.url}/summary`, {
      params,
    });
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
    return this.http.get<TransactionExport[]>(`${this.url}/transactions`, {
      params,
    });
  }

  /** Devuelve el reporte de egresos del período con totales por categoría y método. */
  getExpenses(dateFrom: string, dateTo: string): Observable<ExpensesReport> {
    const params = this.buildParams({ dateFrom, dateTo });
    return this.http.get<ExpensesReport>(`${this.url}/expenses`, { params });
  }
}
