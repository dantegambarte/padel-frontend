import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export interface CashMovimiento {
  id: string;
  hora: string;
  tipo: 'Efectivo' | 'Transferencia';
  concepto: string;
  monto: number;
}

/** Shape normalizado que consume el componente. */
export interface CashCurrentResponse {
  sessionId:          string | null;
  isClosed:           boolean;
  efectivoEsperado:   number;
  transferenciaTotal: number;
  movimientos:        CashMovimiento[];
}

/** Shape real devuelto por el backend GET /cash/current */
interface CashApiResponse {
  session:      { id: string; status: string } | null;
  cashExpected: number;
  transferTotal: number;
  dayTotal:     number;
  transactions: {
    id: string;
    type: string;
    concept: string;
    amountCash: number;
    amountTransfer: number;
    createdAt: string;
  }[];
  isOpen: boolean;
}

export interface CloseCashDto {
  efectivoContado: number;
  notas?: string;
}

export interface CloseCashResponse {
  id: string;
  closedAt: string;
  diferencia: number;
}

@Injectable({ providedIn: 'root' })
export class CashService {
  private readonly url = `${environment.apiUrl}/cash`;

  constructor(private http: HttpClient) {}

  /**
   * GET /cash/current
   * Devuelve el resumen de la sesión activa del día: totales + movimientos.
   * Si no hay sesión abierta el backend devuelve 404 → el componente lo maneja.
   */
  getCurrent(): Observable<CashCurrentResponse> {
    return this.http.get<CashApiResponse>(`${this.url}/current`).pipe(
      map(res => ({
        sessionId:          res.session?.id ?? null,
        isClosed:           !res.isOpen,
        efectivoEsperado:   res.cashExpected   ?? 0,
        transferenciaTotal: res.transferTotal  ?? 0,
        movimientos: (res.transactions ?? []).map(t => ({
          id:       t.id,
          hora:     this.formatHora(t.createdAt),
          tipo:     t.amountCash > 0 ? 'Efectivo' : 'Transferencia' as const,
          concepto: t.concept,
          monto:    t.amountCash + t.amountTransfer,
        })),
      })),
    );
  }

  /**
   * POST /cash/close
   * Cierra la sesión actual con el efectivo contado físicamente.
   */
  close(dto: CloseCashDto): Observable<CloseCashResponse> {
    return this.http.post<CloseCashResponse>(`${this.url}/close`, dto);
  }

  private formatHora(isoString: string): string {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
