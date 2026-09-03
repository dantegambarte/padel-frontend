import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';

import { SalesService, SaleDetail } from '../../core/services/sales.service';

import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';

@Component({
    selector: 'app-ticket-modal',
    templateUrl: './ticket-modal.component.html',
    imports: [
    ModalScrollLockDirective
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketModalComponent {
  readonly saleId = input<string | null>(null);

  readonly closeModal = output<void>();

  sale = signal<SaleDetail | null>(null);
  isLoading = signal(false);
  loadError = signal('');

  constructor(private salesService: SalesService) {
    /** Reacciona a cambios de saleId reemplazando la lógica que antes vivía en ngOnChanges
     * (los signal inputs no disparan ese hook). */
    effect(() => {
      const id = this.saleId();
      if (id) {
        this.fetchSale(id);
      } else {
        this.sale.set(null);
        this.loadError.set('');
      }
    });
  }

  /** Solicita el detalle de la venta al servicio y lo almacena para renderizar el ticket. */
  private fetchSale(id: string): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.sale.set(null);

    this.salesService
      .findOne(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (s) => this.sale.set(s),
        error: () =>
          this.loadError.set('No se pudo cargar el detalle de la venta.'),
      });
  }

  /** Dispara la impresión del ticket en la misma pestaña. */
  print(): void {
    window.print();
  }

  /** Emite el evento de cierre para que el componente padre oculte el modal. */
  close(): void {
    this.closeModal.emit();
  }

  /** Formatea un número (o numeric string de Postgres) con separador de miles (es-AR). */
  fmt(value: number | string): string {
    return Number(value).toLocaleString('es-AR');
  }

  /** Subtotal de un ítem: precio unitario × cantidad. */
  itemSubtotal(unitPrice: number | string, quantity: number): number {
    return Number(unitPrice) * quantity;
  }

  /** Formatea un timestamp ISO a fecha/hora legible en Argentina. */
  formatFechaHora(iso: string): { fecha: string; hora: string } {
    if (!iso) return { fecha: '--', hora: '--' };
    const d = new Date(iso);
    return {
      fecha: d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      hora: d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    };
  }
}
