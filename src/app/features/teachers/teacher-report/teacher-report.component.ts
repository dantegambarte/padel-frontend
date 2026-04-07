import { Component, OnInit } from '@angular/core';

import { TeachersService } from '../../../core/services/teachers.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  Teacher,
  TeacherReport,
  TeacherReportBooking,
} from '../../../core/models/teacher.model';

@Component({
  selector: 'app-teacher-report',
  templateUrl: './teacher-report.component.html',
})
export class TeacherReportComponent implements OnInit {
  teachers: Teacher[] = [];
  selectedTeacherId = '';
  startDate = '';
  endDate = '';

  report: TeacherReport | null = null;
  isLoading = false;
  hasSearched = false;

  constructor(
    private teachersSvc: TeachersService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.startDate = `${y}-${m}-01`;
    this.endDate = `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate().toString().padStart(2, '0')}`;

    this.teachersSvc.findAll(true).subscribe({
      next: (list) => (this.teachers = list),
      error: () =>
        this.toast.error('Error', 'No se pudieron cargar los profesores.'),
    });
  }

  /** True cuando el formulario tiene profesor y rango de fechas completos. */
  get canSearch(): boolean {
    return !!this.selectedTeacherId && !!this.startDate && !!this.endDate;
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
