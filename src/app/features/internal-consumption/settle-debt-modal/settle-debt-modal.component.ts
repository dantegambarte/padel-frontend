import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import {
  InternalConsumption,
  PaymentMethod,
  TeacherDebtSummary,
} from '../../../core/models/internal-consumption.model';
import { Teacher } from '../../../core/models/teacher.model';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';

@Component({
  selector: 'app-settle-debt-modal',
  templateUrl: './settle-debt-modal.component.html',
})
export class SettleDebtModalComponent implements OnInit {
  @Input() teacher!: Teacher;
  @Input() summary!: TeacherDebtSummary;

  @Output() settled = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  consumptions: InternalConsumption[] = [];
  loading = true;
  settling = false;
  error: string | null = null;
  paymentMethod: PaymentMethod = 'cash';

  get total(): number {
    return this.consumptions.reduce(
      (sum, c) => sum + c.unitCostPrice * c.quantity,
      0,
    );
  }

  constructor(private service: InternalConsumptionService) {}

  ngOnInit(): void {
    this.service
      .getAll({
        teacherId: this.teacher.id,
        status: 'pending_payment',
      })
      .subscribe({
        next: (data) => {
          this.consumptions = data;
          this.loading = false;
        },
        error: () => {
          this.error = 'No se pudieron cargar los consumos.';
          this.loading = false;
        },
      });
  }

  /**
   * Inicia el proceso de liquidación de la deuda del docente, enviando una solicitud al servicio para marcar los consumos como pagados y registrar el método de pago. Maneja el estado de carga y posibles errores durante la operación, emitiendo eventos para notificar al componente padre sobre el resultado de la acción.
   */
  onSettle(): void {
    this.settling = true;
    this.error = null;

    this.service
      .settleTeacherDebt({
        teacherId: this.teacher.id,
        paymentMethod: this.paymentMethod,
      })
      .subscribe({
        next: () => {
          this.settling = false;
          this.settled.emit();
        },
        error: (err) => {
          this.settling = false;
          const errorCode = err?.error?.errorCode;
          if (errorCode === 'CAJA_CERRADA') {
            this.error =
              'La caja está cerrada. Abrí un turno de caja antes de registrar este cobro.';
          } else {
            this.error =
              err?.error?.message ?? 'Error al liquidar. Intentá de nuevo.';
          }
        },
      });
  }

  /**
   *  Abre WhatsApp con un mensaje predefinido para recordarle al docente su deuda pendiente, incluyendo el monto total y un llamado a la acción para que se comunique a pagar.
   * @returns
   */
  sendDebtReminder(): void {
    if (!this.teacher.phoneNumber) return;
    const url = this.service.buildDebtReminderWhatsAppUrl(
      this.teacher.phoneNumber,
      this.teacher.fullName,
      this.total,
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Cancela la acción de liquidar deuda y cierra el modal, emitiendo un evento para notificar al componente padre que se canceló la operación.
   */
  onCancel(): void {
    this.cancelled.emit();
  }
}
