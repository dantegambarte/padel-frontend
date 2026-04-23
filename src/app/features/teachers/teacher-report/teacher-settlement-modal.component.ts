import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { InternalConsumption } from '../../../core/models/internal-consumption.model';
import { TeacherReport } from '../../../core/models/teacher.model';
import { PaymentMethod } from '../../../core/models/teacher.model';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { TeachersService } from '../../../core/services/teachers.service';

@Component({
  selector: 'app-teacher-settlement-modal',
  templateUrl: './teacher-settlement-modal.component.html',
})
export class TeacherSettlementModalComponent implements OnInit {
  @Input() report!: TeacherReport;
  @Input() mode: 'clases' | 'completa' = 'completa';

  @Output() settled = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  consumptions: InternalConsumption[] = [];
  loading = true;
  settling = false;
  paymentMethod: PaymentMethod = 'cash';

  /** Devuelve el total de las clases del reporte. */
  get bookingTotal(): number {
    return this.report.summary.totalAmount;
  }

  /** Devuelve el total de los consumos pendientes. */
  get consumptionTotal(): number {
    return this.consumptions.reduce(
      (sum, c) => sum + c.unitCostPrice * c.quantity,
      0,
    );
  }

  /** Devuelve el total general. */
  get grandTotal(): number {
    return this.bookingTotal + this.consumptionTotal;
  }

  constructor(
    private consumptionSvc: InternalConsumptionService,
    private teachersSvc: TeachersService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.mode === 'clases') {
      this.loading = false;
      return;
    }
    this.consumptionSvc
      .getAll({ teacherId: this.report.teacher.id, status: 'pending_payment' })
      .subscribe({
        next: (data) => {
          this.consumptions = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los consumos pendientes.',
          });
        },
      });
  }

  /**
   * Realiza la liquidación del profesor. Si el error es caja cerrada, muestra un mensaje específico con opción a ir a abrir caja. Para otros errores, muestra un mensaje genérico.
   */
  onSettle(): void {
    this.settling = true;

    this.teachersSvc
      .liquidate({
        teacherId: this.report.teacher.id,
        bookingIds: this.report.bookings.map((b) => b.id),
        consumptionIds:
          this.mode === 'clases' ? [] : this.consumptions.map((c) => c.id),
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
            Swal.fire({
              icon: 'error',
              title: 'Caja Cerrada',
              text: 'La caja está cerrada. Abrí un turno de caja antes de registrar este cobro.',
              confirmButtonText: 'Ir a Abrir Caja',
            }).then((result) => {
              if (result.isConfirmed) {
                this.cancelled.emit();
                this.router.navigate(['/app/cash-register']);
              }
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text:
                err?.error?.message ?? 'Error al liquidar. Intentá de nuevo.',
            });
          }
        },
      });
  }

  /**
   * Emite el evento de cancelación para cerrar el modal sin liquidar.
   */
  onCancel(): void {
    this.cancelled.emit();
  }

  /**
   *
   * @param value
   * @returns
   */
  fmt(value: number): string {
    return value.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Formatea una fecha ISO a formato DD/MM/AAAA.
   * @param dateStr
   * @returns
   */
  fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Formatea una cantidad de minutos a formato "Xh Ymin".
   * Si los minutos son exactamente 0, devuelve solo las horas (ej: "2h" en vez de "2h 0min").
   * Si hay minutos, los incluye en el formato (ej: "1h 30min").
   * Este formato es más legible para representar duraciones de clases o consumos.
   *
   * @param minutes
   * @returns
   */
  fmtHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const min = minutes % 60;
    return min === 0 ? `${h}h` : `${h}h ${min}min`;
  }
}
