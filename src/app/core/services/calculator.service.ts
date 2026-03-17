import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Controla la visibilidad del widget de calculadora flotante.
 * Los componentes suscriben a `visible$` para reaccionar a los eventos de apertura/cierre.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorService {
  private readonly _visible$ = new BehaviorSubject<boolean>(false);

  /** Observable que emite `true` cuando la calculadora está visible. */
  readonly visible$ = this._visible$.asObservable();

  /** Abre la calculadora. */
  open(): void {
    this._visible$.next(true);
  }

  /** Cierra la calculadora. */
  close(): void {
    this._visible$.next(false);
  }

  /** Alterna la calculadora entre abierta y cerrada. */
  toggle(): void {
    this._visible$.next(!this._visible$.value);
  }
}
