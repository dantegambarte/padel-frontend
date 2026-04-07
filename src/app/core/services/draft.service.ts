import { Injectable } from '@angular/core';

/**
 * Persiste borradores de formularios en localStorage para resiliencia ante
 * recargas o pérdidas de conexión. Todos los métodos fallan silenciosamente
 * si el storage no está disponible o está lleno.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  /** Serializa y guarda `data` en localStorage bajo `key`. */
  saveDraft(key: string, data: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }

  /** Lee y deserializa el borrador guardado bajo `key`. Devuelve null si no existe o es inválido. */
  getDraft<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** Elimina el borrador almacenado bajo `key`. */
  clearDraft(key: string): void {
    localStorage.removeItem(key);
  }

  /** True si existe un borrador guardado bajo `key`. */
  hasDraft(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
