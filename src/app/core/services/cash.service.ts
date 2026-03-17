import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  efectivoEsperado: number;
  transferenciaTotal: number;
  movimientos: CashMovimiento[];
  sessionDate: string | null;
  openedAt: string | null;
}

/** Estructura cruda devuelta por el endpoint `GET /cash/current` del backend. */
interface CashApiResponse {
  session: {
    id: string;
    status: string;
    date: string;
    openedAt: string;
  } | null;
  cashExpected: number;
  transferTotal: number;
  dayTotal: number;
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
   * PostgreSQL serializa las columnas `numeric` como strings; este método las convierte a números.
   */
  getCurrent(): Observable<CashCurrentResponse> {
    return this.http.get<CashApiResponse>(`${this.url}/current`).pipe(
      map((res) => ({
        sessionId: res.session?.id ?? null,
        isClosed: !res.isOpen,
        efectivoEsperado: Number(res.cashExpected) || 0,
        transferenciaTotal: Number(res.transferTotal) || 0,
        sessionDate: res.session?.date ?? null,
        openedAt: res.session?.openedAt ?? null,
        movimientos: (res.transactions ?? []).map((t) => ({
          id: t.id,
          hora: this.formatHora(t.createdAt),
          tipo:
            Number(t.amountCash) > 0 ? 'Efectivo' : ('Transferencia' as const),
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
    );
  }

  /**
   * Cierra la sesión de caja actual con el monto de efectivo contado físicamente.
   * Mapea los nombres internos del componente (español) a los que espera el DTO
   * del backend: `cashCounted` y `notes`.
   */
  close(dto: CloseCashDto): Observable<CloseCashResponse> {
    const payload: { cashCounted: number; notes?: string } = {
      cashCounted: Number(dto.efectivoContado),
      ...(dto.notas !== undefined && dto.notas !== ''
        ? { notes: dto.notas }
        : {}),
    };
    return this.http.post<CloseCashResponse>(`${this.url}/close`, payload);
  }

  /**
   * Formatea un timestamp ISO a una cadena HH:MM usando el locale argentino.
   * @param isoString - Cadena de fecha y hora en formato ISO 8601.
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
