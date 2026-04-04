import { Injectable } from '@angular/core';

/**
 * Persiste borradores de formularios en localStorage para resiliencia ante
 * recargas o pérdidas de conexión. Todos los métodos fallan silenciosamente
 * si el storage no está disponible o está lleno.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  saveDraft(key: string, data: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* storage lleno o no disponible */
    }
  }

  getDraft<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  clearDraft(key: string): void {
    localStorage.removeItem(key);
  }

  hasDraft(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
