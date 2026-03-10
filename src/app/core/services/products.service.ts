import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Product,
  CreateProductDto,
  UpdateProductDto,
  LowStockProduct,
} from '../models/product.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly url = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  /** GET /products — tabla de gestión de inventario. */
  findAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.url);
  }

  /** GET /products/featured — acceso rápido en Agenda y POS. */
  getFeatured(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.url}/featured`);
  }

  /** GET /products?search=term — búsqueda en tiempo real del modal de Agenda. */
  search(term: string): Observable<Product[]> {
    const params = new HttpParams().set('search', term);
    return this.http.get<Product[]>(this.url, { params });
  }

  /** POST /products — crear nuevo producto. */
  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.url, dto);
  }

  /** PATCH /products/:id — editar producto existente. */
  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.url}/${id}`, dto);
  }

  /** DELETE /products/:id — eliminar producto. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** GET /products/low-stock — productos bajo el mínimo configurado. */
  getLowStock(): Observable<LowStockProduct[]> {
    return this.http.get<LowStockProduct[]>(`${this.url}/low-stock`);
  }
}
