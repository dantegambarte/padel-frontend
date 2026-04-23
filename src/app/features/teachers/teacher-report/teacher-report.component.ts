import { Component, OnInit } from '@angular/core';

import { TeachersService } from '../../../core/services/teachers.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  Teacher,
  TeacherReport,
  TeacherReportBooking,
} from '../../../core/models/teacher.model';

type PeriodType = 'mensual' | 'quincenal' | 'semanal';

@Component({
  selector: 'app-teacher-report',
  templateUrl: './teacher-report.component.html',
})
export class TeacherReportComponent implements OnInit {
  teachers: Teacher[] = [];
  selectedTeacherId = '';
  startDate = '';
  endDate = '';

  periodType: PeriodType = 'mensual';
  startDay = 1;

  report: TeacherReport | null = null;
  isLoading = false;
  hasSearched = false;
  showSettlementModal = false;
  settlementMode: 'clases' | 'completa' = 'completa';

  constructor(
    private teachersSvc: TeachersService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.recalcDates();
    this.teachersSvc.findAll(true).subscribe({
      next: (list) => (this.teachers = list),
      error: () =>
        this.toast.error('Error', 'No se pudieron cargar los profesores.'),
    });
  }

  /** Recalcula startDate y endDate según periodType y startDay. */
  recalcDates(): void {
    const now = new Date();
    const day = Math.max(1, Math.min(28, this.startDay));

    if (this.periodType === 'mensual') {
      const cutThisMonth = new Date(now.getFullYear(), now.getMonth(), day);
      if (now >= cutThisMonth) {
        this.startDate = this.toYMD(cutThisMonth);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, day);
        end.setDate(end.getDate() - 1);
        this.endDate = this.toYMD(end);
      } else {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, day);
        this.startDate = this.toYMD(start);
        const end = new Date(now.getFullYear(), now.getMonth(), day);
        end.setDate(end.getDate() - 1);
        this.endDate = this.toYMD(end);
      }
    } else if (this.periodType === 'quincenal') {
      const mid = 15;
      if (now.getDate() >= mid) {
        this.startDate = this.toYMD(
          new Date(now.getFullYear(), now.getMonth(), mid),
        );
        this.endDate = this.toYMD(
          new Date(now.getFullYear(), now.getMonth() + 1, 0),
        );
      } else {
        this.startDate = this.toYMD(
          new Date(now.getFullYear(), now.getMonth(), 1),
        );
        this.endDate = this.toYMD(
          new Date(now.getFullYear(), now.getMonth(), mid - 1),
        );
      }
    } else {
      const dow = now.getDay() === 0 ? 7 : now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dow - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.startDate = this.toYMD(monday);
      this.endDate = this.toYMD(sunday);
    }
  }

  /**
   * Convierte un objeto Date a string en formato YYYY-MM-DD, ajustando mes y día a 2 dígitos.
   * @param d
   * @returns
   */
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** True cuando el formulario tiene profesor y rango de fechas completos. */
  get canSearch(): boolean {
    return !!this.selectedTeacherId && !!this.startDate && !!this.endDate;
  }

  /** Devuelve true si se debe mostrar el campo de día de inicio. */
  get showStartDay(): boolean {
    return this.periodType === 'mensual';
  }

  /** Solicita el reporte de liquidación al servidor para el profesor y período seleccionados. */
  search(): void {
    if (!this.canSearch) return;
    this.isLoading = true;
    this.hasSearched = true;
    this.report = null;

    this.teachersSvc
      .getReport(this.selectedTeacherId, this.startDate, this.endDate)
      .subscribe({
        next: (data) => {
          this.report = data;
          this.isLoading = false;
        },
        error: () => {
          this.toast.error(
            'Error',
            'No se pudo generar el reporte. Intente nuevamente.',
          );
          this.isLoading = false;
        },
      });
  }

  /** Abre el modal de liquidación en el modo indicado. */
  openSettlement(mode: 'clases' | 'completa'): void {
    this.settlementMode = mode;
    this.showSettlementModal = true;
  }

  /** Cierra el modal sin liquidar. */
  closeSettlement(): void {
    this.showSettlementModal = false;
  }

  /** Callback tras liquidación exitosa: limpia reporte y muestra toast. */
  onSettled(): void {
    this.showSettlementModal = false;
    this.toast.success(
      'Liquidación registrada',
      'La deuda del profesor fue cobrada y registrada en caja.',
    );
    this.report = null;
    this.hasSearched = false;
  }

  /** Dispara la impresión del reporte visible en pantalla. */
  print(): void {
    window.print();
  }

  /** Formatea un número al estilo local argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Convierte una fecha ISO a formato DD/MM/AAAA. */
  fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Convierte minutos totales a formato legible "Xh Ymin". */
  fmtHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const min = minutes % 60;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}min`;
  }

  /** Devuelve el rango de fechas como "DD/MM/AAAA al DD/MM/AAAA". */
  fmtDateRange(start: string, end: string): string {
    return `${this.fmtDate(start)} al ${this.fmtDate(end)}`;
  }
}
