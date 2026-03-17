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

  /** Devuelve todos los productos — usado en la tabla de gestión de inventario. */
  findAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.url);
  }

  /** Devuelve sólo los productos marcados como destacados — acceso rápido en Agenda y POS. */
  getFeatured(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.url}/featured`);
  }

  /** Busca productos por nombre en tiempo real. */
  search(term: string): Observable<Product[]> {
    const params = new HttpParams().set('search', term);
    return this.http.get<Product[]>(this.url, { params });
  }

  /**
   * Crea un nuevo producto.
   * @param dto - Payload de creación.
   */
  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.url, dto);
  }

  /**
   * Actualiza parcialmente un producto existente.
   * @param id  - Identificador del producto.
   * @param dto - Campos a modificar.
   */
  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.url}/${id}`, dto);
  }

  /**
   * Elimina un producto del sistema.
   * @param id - Identificador del producto.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Devuelve los productos con stock por debajo del mínimo configurado. */
  getLowStock(): Observable<LowStockProduct[]> {
    return this.http.get<LowStockProduct[]>(`${this.url}/low-stock`);
  }
}
