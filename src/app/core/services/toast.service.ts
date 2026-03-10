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

  show(toast: Omit<ToastMessage, 'id'>, duration = 4000): void {
    const id = ++this.nextId;
    this.toastsSubject.next([...this.toastsSubject.value, { ...toast, id }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(title: string, description?: string): void {
    this.show({ title, description, variant: 'success' });
  }

  error(title: string, description?: string): void {
    this.show({ title, description, variant: 'destructive' });
  }

  info(title: string, description?: string): void {
    this.show({ title, description, variant: 'default' });
  }

  dismiss(id: number): void {
    this.toastsSubject.next(
      this.toastsSubject.value.filter((t) => t.id !== id),
    );
  }
}
