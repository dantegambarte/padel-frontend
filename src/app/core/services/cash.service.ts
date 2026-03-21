import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

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
  /** Efectivo contado al cerrar (null si la caja sigue abierta). */
  cashCounted: number | null;
  /** Descuadre: contado - esperado (null si la caja sigue abierta). */
  difference: number | null;
  /** Notas del cierre. */
  closedNotes: string | null;
  /** true cuando la sesión abierta pertenece a una jornada comercial anterior al día de hoy. */
  staleSession: boolean;
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

  constructor(private http: HttpClient) {}

  /**
   * Obtiene el resumen de la sesión de caja actual, incluyendo totales y movimientos.
   * - session: null + noSession: true → mostrar pantalla de Apertura de Caja.
   * - session existe + isClosed: false → jornada abierta (dashboard normal).
   * - session existe + isClosed: true → jornada cerrada (modo solo lectura).
   */
  getCurrent(): Observable<CashCurrentResponse> {
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
      cashCounted: null,
      difference: null,
      closedNotes: null,
      staleSession: false,
    };

    return this.http.get<CashApiResponse>(`${this.url}/current`).pipe(
      map((res): CashCurrentResponse => ({
        sessionId: res.session?.id ?? null,
        noSession: res.session === null,
        isClosed: !res.isOpen,
        efectivoEsperado: Number(res.cashExpected) || 0,
        transferenciaTotal: Number(res.transferTotal) || 0,
        initialBalance: Number(res.initialBalance) || 0,
        sessionDate: res.session?.date ?? null,
        openedAt: res.session?.openedAt ?? null,
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
        })),
      })),
      // 404 = no hay sesión para este día → equivale a noSession: true.
      // Cualquier otro error (500, 0, CORS, etc.) se relanza para que la UI
      // muestre un cartel de falla de conexión y NO la pantalla de Apertura.
      catchError((err) => {
        if (err.status === 404) return of(noSessionResponse);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Abre una nueva jornada de caja con el fondo inicial declarado por el empleado.
   */
  open(dto: OpenCashDto): Observable<{ id: string; date: string; status: string }> {
    return this.http.post<{ id: string; date: string; status: string }>(
      `${this.url}/open`,
      { initialBalance: dto.initialBalance, ...(dto.notes ? { notes: dto.notes } : {}) },
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
    return this.http.post<CloseCashResponse>(`${this.url}/close`, payload);
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
