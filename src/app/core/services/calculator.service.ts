import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service that controls the visibility of the floating calculator widget.
 * Components subscribe to `visible$` to react to open/close events.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorService {
  private readonly _visible$ = new BehaviorSubject<boolean>(false);

  /** Observable that emits `true` when the calculator is visible. */
  readonly visible$ = this._visible$.asObservable();

  /** Opens the calculator. */
  open(): void {
    this._visible$.next(true);
  }

  /** Closes the calculator. */
  close(): void {
    this._visible$.next(false);
  }

  /** Toggles the calculator between open and closed states. */
  toggle(): void {
    this._visible$.next(!this._visible$.value);
  }
}
