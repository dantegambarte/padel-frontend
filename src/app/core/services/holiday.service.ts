import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Gestiona el "Modo Feriado" de la aplicación.
 * Cuando está activo, el motor de precios trata cualquier día de la semana
 * como si fuera sábado (día 6), aplicando las tarifas de fin de semana.
 *
 * El estado persiste en localStorage bajo la clave 'padelsys-holiday-mode',
 * sobreviviendo a recargas de página.
 */
@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly STORAGE_KEY = 'padelsys-holiday-mode';

  isHoliday$ = new BehaviorSubject<boolean>(this.readFromStorage());

  /** True si el modo feriado está actualmente activo. */
  get isHoliday(): boolean {
    return this.isHoliday$.value;
  }

  /** Alterna el estado del modo feriado y lo persiste en localStorage. */
  toggle(): void {
    const next = !this.isHoliday$.value;
    try {
      localStorage.setItem(this.STORAGE_KEY, next ? 'true' : 'false');
    } catch {}
    this.isHoliday$.next(next);
  }

  /** Lee el estado del modo feriado desde localStorage. */
  private readFromStorage(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
