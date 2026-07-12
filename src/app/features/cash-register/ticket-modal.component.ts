import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { finalize } from 'rxjs';

import { SalesService, SaleDetail } from '../../core/services/sales.service';

@Component({
  selector: 'app-ticket-modal',
  templateUrl: './ticket-modal.component.html',
})
export class TicketModalComponent implements OnChanges {
  @Input() saleId: string | null = null;

  @Output() closeModal = new EventEmitter<void>();

  sale: SaleDetail | null = null;
  isLoading = false;
  loadError = '';

  constructor(private salesService: SalesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['saleId'] && this.saleId) {
      this.fetchSale(this.saleId);
    }
    if (changes['saleId'] && !this.saleId) {
      this.sale = null;
      this.loadError = '';
    }
  }

  /** Solicita el detalle de la venta al servicio y lo almacena para renderizar el ticket. */
  private fetchSale(id: string): void {
    this.isLoading = true;
    this.loadError = '';
    this.sale = null;

    this.salesService
      .findOne(id)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (s) => (this.sale = s),
        error: () =>
          (this.loadError = 'No se pudo cargar el detalle de la venta.'),
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
