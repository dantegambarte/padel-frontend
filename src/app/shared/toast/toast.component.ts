import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { ToastService, ToastMessage } from '../../core/services/toast.service';
import { NgFor, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgIf } from '@angular/common';

/**
 * Animación de entrada/salida estilo Sileo/iOS:
 * - Entrada: desliza desde arriba con fade-in (ease-out, 300ms)
 * - Salida:  sube y desvanece (ease-in, 200ms)
 */
export const toastAnimation = trigger('toastState', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-110%) scale(0.96)' }),
    animate(
      '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '200ms ease-in',
      style({ opacity: 0, transform: 'translateY(-60%) scale(0.96)' }),
    ),
  ]),
]);

@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    animations: [toastAnimation],
    imports: [
        NgFor,
        NgClass,
        NgSwitch,
        NgSwitchCase,
        NgSwitchDefault,
        NgIf,
    ],
})
export class ToastComponent {
  private toastService = inject(ToastService);
  toasts = toSignal(this.toastService.toasts$, { initialValue: [] as ToastMessage[] });

  /** Descarta el toast con el id indicado. */
  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  /**
   * Devuelve las clases de acento (icono + borde izquierdo indicador) según variante.
   * El fondo glassmorphism es compartido para todos; solo cambia el color de acento.
   */
  iconClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'text-slate-500',
      success: 'text-emerald-500',
      destructive: 'text-rose-500',
    };
    return map[variant];
  }

  accentBarClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'bg-slate-400',
      success: 'bg-emerald-400',
      destructive: 'bg-rose-500',
    };
    return map[variant];
  }

  /** Fondo glassmorphism con tinte de color según variante. */
  cardBgClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'bg-slate-800/80',
      success: 'bg-emerald-900/80',
      destructive: 'bg-rose-900/80',
    };
    return map[variant];
  }

  titleClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'text-slate-100',
      success: 'text-emerald-100',
      destructive: 'text-rose-100',
    };
    return map[variant];
  }

  descClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'text-slate-400',
      success: 'text-emerald-300/80',
      destructive: 'text-rose-300/80',
    };
    return map[variant];
  }

  closeClass(variant: ToastMessage['variant']): string {
    const map: Record<ToastMessage['variant'], string> = {
      default: 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60',
      success:
        'text-emerald-400/70 hover:text-emerald-100 hover:bg-emerald-800/60',
      destructive: 'text-rose-400/70 hover:text-rose-100 hover:bg-rose-800/60',
    };
    return map[variant];
  }

  trackById(_: number, toast: ToastMessage): number {
    return toast.id;
  }
}
