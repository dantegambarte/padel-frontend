import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Par clave-valor de una entrada de configuración del sistema. */
export interface ConfigEntry {
  key: string;
  value: string;
}

/**
 * Servicio de configuración global con caché en memoria para `getAll()`.
 *
 * Estrategia:
 * - La lista de entradas se cachea con `shareReplay(1)` ya que la configuración
 *   es muy estable y se lee con frecuencia desde múltiples componentes.
 * - `updateBulk()` invalida la caché al completarse con éxito.
 * - `clearCache()` es llamado también desde `AuthService.logout()`.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly url = `${environment.apiUrl}/config`;

  private configCache$: Observable<ConfigEntry[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Obtiene todas las entradas de configuración. Sirve desde caché si está disponible. */
  getAll(): Observable<ConfigEntry[]> {
    if (!this.configCache$) {
      this.configCache$ = this.http
        .get<ConfigEntry[]>(this.url)
        .pipe(shareReplay(1));
    }
    return this.configCache$;
  }

  /** Invalida la caché de configuración. */
  clearCache(): void {
    this.configCache$ = null;
  }

  /**
   * Actualiza en bloque un conjunto de entradas de configuración e invalida la caché.
   * @param entries - Array de pares clave-valor a persistir.
   */
  updateBulk(entries: ConfigEntry[]): Observable<ConfigEntry[]> {
    const configs: Record<string, string> = {};
    entries.forEach((e) => (configs[e.key] = e.value));
    return this.http.put<ConfigEntry[]>(`${this.url}/bulk`, { configs }).pipe(
      tap(() => this.clearCache()),
    );
  }
}
