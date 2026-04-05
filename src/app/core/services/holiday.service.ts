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

  get isHoliday(): boolean {
    return this.isHoliday$.value;
  }

  toggle(): void {
    const next = !this.isHoliday$.value;
    try {
      localStorage.setItem(this.STORAGE_KEY, next ? 'true' : 'false');
    } catch { /* storage not available */ }
    this.isHoliday$.next(next);
  }

  private readFromStorage(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
