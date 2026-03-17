import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);

  readonly toasts$ = this.toastsSubject.asObservable();

  /**
   * Muestra un toast durante `duration` milisegundos y luego lo descarta automáticamente.
   * @param toast    - Datos del mensaje (sin id).
   * @param duration - Tiempo de visibilidad en ms (por defecto 4000).
   */
  show(toast: Omit<ToastMessage, 'id'>, duration = 4000): void {
    const id = ++this.nextId;
    this.toastsSubject.next([...this.toastsSubject.value, { ...toast, id }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  /** Muestra un toast de éxito. */
  success(title: string, description?: string): void {
    this.show({ title, description, variant: 'success' });
  }

  /** Muestra un toast de error. */
  error(title: string, description?: string): void {
    this.show({ title, description, variant: 'destructive' });
  }

  /** Muestra un toast informativo. */
  info(title: string, description?: string): void {
    this.show({ title, description, variant: 'default' });
  }

  /**
   * Elimina el toast con el id indicado de la lista visible.
   * @param id - Identificador numérico del toast.
   */
  dismiss(id: number): void {
    this.toastsSubject.next(
      this.toastsSubject.value.filter((t) => t.id !== id),
    );
  }
}
