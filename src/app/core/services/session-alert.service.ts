import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SessionAlertType = 'SESSION_OVERRIDDEN' | 'TOKEN_EXPIRED' | null;

/**
 * Gestiona la alerta bloqueante que se muestra cuando la sesión es interrumpida.
 * El componente `SessionAlertComponent` se suscribe a `alert$` y renderiza el modal.
 */
@Injectable({ providedIn: 'root' })
export class SessionAlertService {
  private alertSubject = new BehaviorSubject<SessionAlertType>(null);

  /** Stream del tipo de alerta activa. `null` = sin alerta. */
  readonly alert$ = this.alertSubject.asObservable();

  /** Activa la alerta bloqueante del tipo indicado. */
  show(type: SessionAlertType): void {
    this.alertSubject.next(type);
  }

  /** Cierra la alerta activa. */
  dismiss(): void {
    this.alertSubject.next(null);
  }
}
