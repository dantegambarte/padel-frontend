import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface SearchResultItem {
  id: string;
  label: string;
  subLabel?: string;
  /** Presente solo en resultados de tipo Reserva: fecha YYYY-MM-DD para query param. */
  date?: string;
}

export interface SearchResponse {
  products: SearchResultItem[];
  bookings: SearchResultItem[];
  sales: SearchResultItem[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly url = `${environment.apiUrl}/search`;

  constructor(private http: HttpClient) {}

  search(q: string): Observable<SearchResponse> {
    const params = new HttpParams().set('q', q.trim());
    return this.http.get<SearchResponse>(this.url, { params });
  }
}
