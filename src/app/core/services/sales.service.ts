import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  create(dto: CreateSaleDto): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(this.url, dto);
  }
}
