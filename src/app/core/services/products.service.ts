import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import {
  Product,
  CreateProductDto,
  UpdateProductDto,
  LowStockProduct,
} from '../models/product.model';
import { environment } from '../../../environments/environment';

/**
 * Servicio de productos con caché en memoria para `findAll()` y `getFeatured()`.
 *
 * Estrategia:
 * - Las listas completas y de destacados se cachean con `shareReplay(1)`.
 * - Cualquier mutación (create / update / remove) invalida ambas cachés.
 * - `clearCache()` es llamado también desde `AuthService.logout()` para
 *   evitar datos residuales al cambiar de usuario.
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly url = `${environment.apiUrl}/products`;

  private allCache$: Observable<Product[]> | null = null;
  private featuredCache$: Observable<Product[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Devuelve todos los productos — con caché. */
  findAll(): Observable<Product[]> {
    if (!this.allCache$) {
      this.allCache$ = this.http.get<Product[]>(this.url).pipe(shareReplay(1));
    }
    return this.allCache$;
  }

  /** Devuelve sólo los productos destacados — con caché. */
  getFeatured(): Observable<Product[]> {
    if (!this.featuredCache$) {
      this.featuredCache$ = this.http
        .get<Product[]>(`${this.url}/featured`)
        .pipe(shareReplay(1));
    }
    return this.featuredCache$;
  }

  /** Devuelve todas las categorías disponibles — sin caché (lista relativamente estable). */
  getCategories(): Observable<{ id: string; name: string }[]> {
    return this.http.get<{ id: string; name: string }[]>(`${this.url}/categories`);
  }

  /**
   * Crea una categoría si no existe (idempotente por nombre).
   * El backend retorna la categoría existente si ya hay una con ese nombre.
   */
  createCategory(name: string): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(`${this.url}/categories`, { name });
  }

  /** Busca productos por nombre en tiempo real — sin caché (query dinámica). */
  search(term: string): Observable<Product[]> {
    const params = new HttpParams().set('search', term);
    return this.http.get<Product[]>(this.url, { params });
  }

  /** Invalida toda la caché de productos. */
  clearCache(): void {
    this.allCache$ = null;
    this.featuredCache$ = null;
  }

  /**
   * Crea un nuevo producto e invalida la caché.
   * @param dto - Payload de creación.
   */
  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.url, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  /**
   * Actualiza parcialmente un producto existente e invalida la caché.
   * @param id  - Identificador del producto.
   * @param dto - Campos a modificar.
   */
  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.url}/${id}`, dto).pipe(
      tap(() => this.clearCache()),
    );
  }

  /**
   * Elimina un producto del sistema e invalida la caché.
   * @param id - Identificador del producto.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.clearCache()),
    );
  }

  /** Devuelve los productos con stock por debajo del mínimo — sin caché (dato volátil). */
  getLowStock(): Observable<LowStockProduct[]> {
    return this.http.get<LowStockProduct[]>(`${this.url}/low-stock`);
  }
}
