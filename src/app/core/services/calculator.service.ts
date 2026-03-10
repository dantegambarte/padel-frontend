import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  private readonly _visible$ = new BehaviorSubject<boolean>(false);
  readonly visible$ = this._visible$.asObservable();

  open(): void {
    this._visible$.next(true);
  }
  close(): void {
    this._visible$.next(false);
  }
  toggle(): void {
    this._visible$.next(!this._visible$.value);
  }
}
