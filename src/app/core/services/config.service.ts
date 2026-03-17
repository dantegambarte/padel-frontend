import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Par clave-valor de una entrada de configuración del sistema. */
export interface ConfigEntry {
  key: string;
  value: string;
}

/**
 * Servicio para leer y escribir entradas de configuración global del sistema.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly url = `${environment.apiUrl}/config`;

  constructor(private http: HttpClient) {}

  /** Obtiene todas las entradas de configuración. */
  getAll(): Observable<ConfigEntry[]> {
    return this.http.get<ConfigEntry[]>(this.url);
  }

  /**
   * Actualiza en bloque un conjunto de entradas de configuración en una sola request.
   * @param entries - Array de pares clave-valor a persistir.
   */
  updateBulk(entries: ConfigEntry[]): Observable<ConfigEntry[]> {
    const configs: Record<string, string> = {};
    entries.forEach((e) => (configs[e.key] = e.value));
    return this.http.put<ConfigEntry[]>(`${this.url}/bulk`, { configs });
  }
}
