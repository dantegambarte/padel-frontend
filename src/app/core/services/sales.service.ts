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
  /** Numeric column de Postgres: llega como string, convertir con `Number()` al usar. */
  unitPrice: string;
  product: { name: string };
}

/** Numeric columns de Postgres (total, amountCash, amountTransfer) llegan como string. */
export interface SaleDetail {
  id: string;
  total: string;
  amountCash: string;
  amountTransfer: string;
  customerName: string | null;
  status?: 'open' | 'paid';
  createdAt: string;
  items: SaleItemDetail[];
}

export interface AddItemsDto {
  items: { productId: string; quantity: number }[];
}

export interface PaySaleDto {
  amountCash: number;
  amountTransfer: number;
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

  /**
   * Lista las cuentas abiertas (status 'open') pendientes de cobro.
   * El backend devuelve las entidades Sale completas, con items y producto incluidos.
   */
  findOpen(): Observable<SaleDetail[]> {
    return this.http.get<SaleDetail[]>(`${this.url}/open`);
  }

  /** Crea una venta con status 'open' para dejarla pendiente de cobro. */
  createOpen(
    customerName: string,
    items: { productId: string; quantity: number }[],
  ): Observable<SaleResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<SaleResponse>(
      this.url,
      { customerName, items, status: 'open' },
      { headers },
    );
  }

  /** Agrega ítems (delta) a una cuenta abierta existente. */
  addItems(saleId: string, dto: AddItemsDto): Observable<SaleDetail> {
    return this.http.patch<SaleDetail>(`${this.url}/${saleId}/add-items`, dto);
  }

  /** Cobra y cierra una cuenta que estaba abierta. */
  pay(saleId: string, dto: PaySaleDto): Observable<SaleResponse> {
    const headers = new HttpHeaders({
      'X-Idempotency-Key': crypto.randomUUID(),
    });
    return this.http.post<SaleResponse>(`${this.url}/${saleId}/pay`, dto, {
      headers,
    });
  }
}
