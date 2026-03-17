import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface CreateSaleDto {
  items: { productId: string; quantity: number }[];
  amountCash: number;
  amountTransfer: number;
  customerName?: string;
}

export interface SaleResponse {
  id: string;
  total: number;
  createdAt: string;
}

export interface SaleItemDetail {
  productId: string;
  quantity: number;
  unitPrice: number;
  product: { name: string };
}

export interface SaleDetail {
  id: string;
  total: number;
  amountCash: number;
  amountTransfer: number;
  customerName: string | null;
  createdAt: string;
  items: SaleItemDetail[];
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly url = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  /**
   * Confirma una venta de mostrador.
   * Envía un `X-Idempotency-Key` único para que el backend detecte y rechace duplicados.
   */
  create(dto: CreateSaleDto): Observable<SaleResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<SaleResponse>(this.url, dto, { headers });
  }

  /**
   * Obtiene el detalle completo de una venta por su ID.
   * Usado para mostrar la comanda de consumo en el Cierre de Caja.
   */
  findOne(id: string): Observable<SaleDetail> {
    return this.http.get<SaleDetail>(`${this.url}/${id}`);
  }
}
