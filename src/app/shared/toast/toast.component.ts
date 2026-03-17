import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { ToastService, ToastMessage } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private sub = new Subscription();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub.add(
      this.toastService.toasts$.subscribe((toasts) => {
        this.toasts = toasts;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Descarta el toast con el id indicado. */
  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  /**
   * Devuelve las clases CSS del toast según su variante.
   * Usa colores concretos (no variables CSS) para garantizar contraste independientemente del tema.
   */
  toastClass(variant: ToastMessage['variant']): string {
    const base =
      'flex items-start gap-3 rounded-lg border p-4 shadow-xl ' +
      'animate-in slide-in-from-right-full duration-300';
    const variants: Record<ToastMessage['variant'], string> = {
      default: `${base} border-gray-200 bg-white text-gray-900`,
      success: `${base} border-green-200 bg-green-50 text-green-900`,
      destructive: `${base} border-red-200   bg-red-50   text-red-900`,
    };
    return variants[variant];
  }
}
