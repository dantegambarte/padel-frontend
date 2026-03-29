import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, shareReplay } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

/** Detalle de un ítem de producto dentro de un turno o venta. */
export interface ItemDetail {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Un movimiento de caja individual que se muestra en la lista de transacciones del día. */
export interface CashMovimiento {
  id: string;
  hora: string;
  tipo: 'Efectivo' | 'Transferencia';
  concepto: string;
  monto: number;
  amountCash: number;
  amountTransfer: number;
  referenceId: string;
  movType: 'SALE' | 'BOOKING';
  customerName?: string | null;
  userName: string;
  /** Datos estructurados del turno (solo cuando movType === 'BOOKING'). */
  bookingClientName?: string | null;
  bookingHour?: string | null;
  bookingCourtName?: string | null;
  bookingPriceAmount?: number | null;
  /** Ítems de productos del turno (booking_items). */
  bookingItems?: ItemDetail[] | null;
  /** Total de la venta (solo cuando movType === 'SALE'). */
  saleTotal?: number | null;
  /** Ítems de productos de la venta (sale_items). */
  saleItems?: ItemDetail[] | null;
}

/** Estructura normalizada consumida por el componente de caja. */
export interface CashCurrentResponse {
  sessionId: string | null;
  isClosed: boolean;
  /** true cuando no hay ninguna sesión (ni abierta ni cerrada del día comercial). Muestra pantalla de Apertura. */
  noSession: boolean;
  efectivoEsperado: number;
  transferenciaTotal: number;
  /** Fondo de caja / cambio inicial declarado al abrir la jornada. */
  initialBalance: number;
  movimientos: CashMovimiento[];
  sessionDate: string | null;
  openedAt: string | null;
  /** Nombre completo del cajero que abrió este turno. */
  openedByName: string | null;
  /** Efectivo contado al cerrar (null si la caja sigue abierta). */
  cashCounted: number | null;
  /** Descuadre: contado - esperado (null si la caja sigue abierta). */
  difference: number | null;
  /** Notas del cierre. */
  closedNotes: string | null;
  /** true cuando la sesión abierta pertenece a una jornada comercial anterior al día de hoy. */
  staleSession: boolean;
}

// ── Interfaces para el endpoint daily-summary ──────────────────────────────

/** Detalle de un turno individual dentro del consolidado diario. */
export interface DailySummaryShift {
  sessionId: string;
  openedByName: string;
  openedAt: string;
  closedAt: string | null;
  status: 'open' | 'closed';
  cashExpected: number;
  transferTotal: number;
  dayTotal: number;
  cashCounted: number | null;
  difference: number | null;
}

/** Respuesta del endpoint GET /cash/daily-summary. */
export interface DailySummaryResponse {
  date: string;
  /** Suma de efectivo + transferencias de todos los turnos del día. */
  totalExpected: number;
  /** Suma del efectivo físico contado. null si algún turno sigue abierto. */
  totalCounted: number | null;
  sessions: DailySummaryShift[];
}

/** Estructura cruda devuelta por el endpoint `GET /cash/current` del backend. */
interface CashApiResponse {
  session: {
    id: string;
    status: string;
    date: string;
    openedAt: string;
    initialBalance?: number | null;
    cashCounted?: number | null;
    difference?: number | null;
    notes?: string | null;
    openedByUser?: { fullName?: string; username?: string } | null;
  } | null;
  cashExpected: number;
  transferTotal: number;
  dayTotal: number;
  initialBalance: number;
  transactions: {
    id: string;
    type: string;
    referenceId: string;
    concept: string;
    amountCash: number;
    amountTransfer: number;
    createdAt: string;
    customerName?: string | null;
    createdByFullName?: string | null;
    createdByUsername?: string | null;
    bookingClientName?: string | null;
    bookingHour?: string | null;
    bookingCourtName?: string | null;
    bookingPriceAmount?: number | null;
    saleTotal?: number | null;
    bookingItems?: ItemDetail[] | null;
    saleItems?: ItemDetail[] | null;
  }[];
  isOpen: boolean;
  /** true si la sesión abierta pertenece a una jornada comercial anterior al día de hoy. */
  staleSession: boolean;
}

/** Payload para abrir una nueva sesión de caja. */
export interface OpenCashDto {
  initialBalance: number;
  notes?: string;
}

/** Payload interno del componente de caja (nombres en español). */
export interface CloseCashDto {
  efectivoContado: number;
  notas?: string;
}

/** Respuesta devuelta tras un cierre de caja exitoso. */
export interface CloseCashResponse {
  id: string;
  closedAt: string;
  diferencia: number;
}

/**
 * Servicio para interactuar con los endpoints de la API de caja.
 */
@Injectable({ providedIn: 'root' })
export class CashService {
  private readonly url = `${environment.apiUrl}/cash`;

  /**
   * Caché de corta duración para `getCurrent()`.
   * Previene peticiones duplicadas cuando varios componentes (Layout, CashRegister,
   * DashboardEmployee) se montan en el mismo ciclo de navegación.
   * Se invalida automáticamente tras TTL o ante cualquier mutación (open/close).
   */
  private currentCache$: Observable<CashCurrentResponse> | null = null;
  private readonly CURRENT_CACHE_TTL_MS = 10_000;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene el resumen de la sesión de caja actual, incluyendo totales y movimientos.
   * - session: null + noSession: true → mostrar pantalla de Apertura de Caja.
   * - session existe + isClosed: false → jornada abierta (dashboard normal).
   * - session existe + isClosed: true → jornada cerrada (modo solo lectura).
   *
   * Implementa caché con TTL de 10 s para deduplicar las llamadas simultáneas
   * que disparan Layout, CashRegister y DashboardEmployee al montar en el mismo ciclo.
   */
  getCurrent(): Observable<CashCurrentResponse> {
    if (this.currentCache$) return this.currentCache$;

    const noSessionResponse: CashCurrentResponse = {
      sessionId: null,
      noSession: true,
      isClosed: false,
      efectivoEsperado: 0,
      transferenciaTotal: 0,
      initialBalance: 0,
      movimientos: [],
      sessionDate: null,
      openedAt: null,
      openedByName: null,
      cashCounted: null,
      difference: null,
      closedNotes: null,
      staleSession: false,
    };

    this.currentCache$ = this.http.get<CashApiResponse>(`${this.url}/current`).pipe(
      map((res): CashCurrentResponse => ({
        sessionId: res.session?.id ?? null,
        noSession: res.session === null,
        isClosed: !res.isOpen,
        efectivoEsperado: Number(res.cashExpected) || 0,
        transferenciaTotal: Number(res.transferTotal) || 0,
        initialBalance: Number(res.initialBalance) || 0,
        sessionDate: res.session?.date ?? null,
        openedAt: res.session?.openedAt ?? null,
        openedByName: res.session?.openedByUser?.fullName ?? res.session?.openedByUser?.username ?? null,
        cashCounted: res.session?.cashCounted != null ? Number(res.session.cashCounted) : null,
        difference: res.session?.difference != null ? Number(res.session.difference) : null,
        closedNotes: res.session?.notes ?? null,
        staleSession: res.staleSession ?? false,
        movimientos: (res.transactions ?? []).map((t) => ({
          id: t.id,
          hora: this.formatHora(t.createdAt),
          tipo: Number(t.amountCash) > 0 ? 'Efectivo' : ('Transferencia' as const),
          concepto: t.concept,
          monto: Number(t.amountCash) + Number(t.amountTransfer),
          amountCash: Number(t.amountCash),
          amountTransfer: Number(t.amountTransfer),
          referenceId: t.referenceId,
          movType: t.type.toUpperCase() as 'SALE' | 'BOOKING',
          customerName: t.customerName ?? null,
          userName: t.createdByFullName ?? t.createdByUsername ?? 'Desconocido',
          bookingClientName: t.bookingClientName ?? null,
          bookingHour: t.bookingHour ?? null,
          bookingCourtName: t.bookingCourtName ?? null,
          bookingPriceAmount: t.bookingPriceAmount != null ? Number(t.bookingPriceAmount) : null,
          bookingItems: t.bookingItems ?? null,
          saleTotal: t.saleTotal != null ? Number(t.saleTotal) : null,
          saleItems: t.saleItems ?? null,
        })),
      })),
      // 404 = no hay sesión para este día → equivale a noSession: true.
      // Cualquier otro error (500, 0, CORS, etc.) se relanza para que la UI
      // muestre un cartel de falla de conexión y NO la pantalla de Apertura.
      // En caso de error de red limpiamos la caché para permitir reintentos inmediatos.
      catchError((err) => {
        if (err.status === 404) return of(noSessionResponse);
        this.clearCurrentCache();
        return throwError(() => err);
      }),
      shareReplay(1),
    );

    // Invalida la caché tras el TTL para que el próximo llamador fuera de la
    // ventana de deduplicación siempre obtenga datos frescos del servidor.
    setTimeout(() => this.clearCurrentCache(), this.CURRENT_CACHE_TTL_MS);

    return this.currentCache$;
  }

  /** Invalida la caché de `getCurrent()`. Llamar tras cualquier mutación de caja. */
  clearCurrentCache(): void {
    this.currentCache$ = null;
  }

  /**
   * Abre una nueva jornada de caja con el fondo inicial declarado por el empleado.
   */
  open(dto: OpenCashDto): Observable<{ id: string; date: string; status: string }> {
    return this.http.post<{ id: string; date: string; status: string }>(
      `${this.url}/open`,
      { initialBalance: dto.initialBalance, ...(dto.notes ? { notes: dto.notes } : {}) },
    ).pipe(tap(() => this.clearCurrentCache()));
  }

  /**
   * Obtiene el consolidado diario de todos los turnos del día comercial indicado.
   * Solo accesible por administradores (el backend devuelve 403 para empleados).
   */
  getDailySummary(date: string): Observable<DailySummaryResponse> {
    return this.http.get<DailySummaryResponse>(`${this.url}/daily-summary`, {
      params: { date },
    });
  }

  /**
   * Descarga el Excel de Cierre X de un turno específico (Blob).
   * Requiere responseType: 'blob' para que Angular no parsee el binario como JSON.
   */
  exportSession(sessionId: string): Observable<Blob> {
    return this.http.get(`${this.url}/export/session/${sessionId}`, {
      responseType: 'blob',
    });
  }

  /**
   * Descarga el Excel consolidado de Cierre del Turno de toda la jornada (Blob).
   * Requiere responseType: 'blob' para que Angular no parsee el binario como JSON.
   */
  exportDaily(date: string): Observable<Blob> {
    return this.http.get(`${this.url}/export/daily`, {
      params: { date },
      responseType: 'blob',
    });
  }

  /**
   * Cierre de Jornada Completa: valida que no haya turnos abiertos y
   * devuelve el consolidado del día comercial actual.
   * Lanza 409 si hay algún turno OPEN.
   */
  closeDay(): Observable<DailySummaryResponse> {
    return this.http.post<DailySummaryResponse>(`${this.url}/close-day`, {}).pipe(
      tap(() => this.clearCurrentCache()),
    );
  }

  /**
   * Cierra la sesión de caja actual con el monto de efectivo contado físicamente.
   */
  close(dto: CloseCashDto): Observable<CloseCashResponse> {
    const payload: { cashCounted: number; notes?: string } = {
      cashCounted: Number(dto.efectivoContado),
      ...(dto.notas !== undefined && dto.notas !== '' ? { notes: dto.notas } : {}),
    };
    return this.http.post<CloseCashResponse>(`${this.url}/close`, payload).pipe(
      tap(() => this.clearCurrentCache()),
    );
  }

  /**
   * Formatea un timestamp ISO a una cadena HH:MM usando el locale argentino.
   */
  private formatHora(isoString: string): string {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
