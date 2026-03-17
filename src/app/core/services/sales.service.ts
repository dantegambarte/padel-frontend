import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CreateSaleDto {
  items: { productId: string; quantity: number }[];
  amountCash: number;
  amountTransfer: number;
}

export interface SaleResponse {
  id: string;
  total: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly url = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  /**
   * Confirma una venta de mostrador.
   * Envía un `X-Idempotency-Key` único para que el backend detecte y rechace duplicados.
   * @param dto - Items vendidos y montos de pago.
   */
  create(dto: CreateSaleDto): Observable<SaleResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<SaleResponse>(this.url, dto, { headers });
  }
}
