import { Component, OnInit } from '@angular/core';

import { TeachersService } from '../../../core/services/teachers.service';
import { ToastService } from '../../../core/services/toast.service';
import { Teacher, TeacherReport, TeacherReportBooking } from '../../../core/models/teacher.model';

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
    // Rango por defecto: mes actual
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.startDate = `${y}-${m}-01`;
    this.endDate   = `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate().toString().padStart(2, '0')}`;

    this.teachersSvc.findAll(true).subscribe({
      next: (list) => (this.teachers = list),
      error: () => this.toast.error('Error', 'No se pudieron cargar los profesores.'),
    });
  }

  get canSearch(): boolean {
    return !!this.selectedTeacherId && !!this.startDate && !!this.endDate;
  }

  search(): void {
    if (!this.canSearch) return;
    this.isLoading = true;
    this.hasSearched = true;
    this.report = null;

    this.teachersSvc.getReport(this.selectedTeacherId, this.startDate, this.endDate).subscribe({
      next: (data) => {
        this.report = data;
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Error', 'No se pudo generar el reporte. Intente nuevamente.');
        this.isLoading = false;
      },
    });
  }

  print(): void {
    window.print();
  }

  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  fmtDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  fmtHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const min = minutes % 60;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}min`;
  }

  fmtDateRange(start: string, end: string): string {
    return `${this.fmtDate(start)} al ${this.fmtDate(end)}`;
  }
}
