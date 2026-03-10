import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ConfigEntry {
  key: string;
  value: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly url = `${environment.apiUrl}/config`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ConfigEntry[]> {
    return this.http.get<ConfigEntry[]>(this.url);
  }

  updateBulk(entries: ConfigEntry[]): Observable<ConfigEntry[]> {
    const configs: Record<string, string> = {};
    entries.forEach((e) => (configs[e.key] = e.value));
    return this.http.put<ConfigEntry[]>(`${this.url}/bulk`, { configs });
  }
}
