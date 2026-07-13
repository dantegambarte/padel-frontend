import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  EnrichedDebtSummary,
  InternalConsumption,
  InternalConsumptionFilters,
  InternalConsumptionStatus,
} from '../../../core/models/internal-consumption.model';
import { Teacher } from '../../../core/models/teacher.model';
import { AuthService } from '../../../core/services/auth.service';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { TeachersService } from '../../../core/services/teachers.service';

@Component({
  standalone: false,
  selector: 'app-internal-consumption-list',
  templateUrl: './internal-consumption-list.component.html',
})
export class InternalConsumptionListComponent implements OnInit {
  consumptions: InternalConsumption[] = [];
  debtSummary: EnrichedDebtSummary[] = [];
  teachers: Teacher[] = [];
  loading = false;
  error: string | null = null;

  filters: InternalConsumptionFilters = {};
  dateFrom = '';
  dateTo = '';

  showForm = false;

  settleTarget: { teacher: Teacher; summary: EnrichedDebtSummary } | null =
    null;

  readonly statusLabels: Record<InternalConsumptionStatus, string> = {
    staff_consumption: 'Consumo empleado',
    pending_payment: 'Deuda pendiente',
    paid: 'Pagado',
  };

  readonly statusClasses: Record<InternalConsumptionStatus, string> = {
    staff_consumption: 'bg-blue-500/15 text-blue-400',
    pending_payment: 'bg-yellow-500/15 text-yellow-400',
    paid: 'bg-green-500/15 text-green-400',
  };

  constructor(
    private authService: AuthService,
    private service: InternalConsumptionService,
    private teachersService: TeachersService,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.dateFrom = `${y}-${m}-01`;
    this.dateTo = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    this.loadAll();
  }

  /** Load consumptions + debt summary + teachers in parallel. */
  loadAll(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      consumptions: this.service.getAll({
        ...this.filters,
        dateFrom: this.dateFrom || undefined,
        dateTo: this.dateTo || undefined,
      }),
      summary: this.service.getTeacherDebtSummary(),
      teachers: this.teachersService.findAll(
        this.authService.currentUser?.role === 'admin',
      ),
    }).subscribe({
      next: ({ consumptions, summary, teachers }) => {
        this.consumptions = consumptions;
        this.teachers = teachers;
        this.debtSummary = summary.map((s) => {
          const t = teachers.find((t) => t.id === s.teacherId);
          return {
            ...s,
            teacherName: t?.fullName ?? `Profesor #${s.teacherId.slice(0, 8)}`,
            phoneNumber: t?.phoneNumber ?? null,
          };
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los datos. Intentá de nuevo.';
        this.loading = false;
      },
    });
  }

  load(): void {
    this.loadAll();
  }

  applyFilters(): void {
    this.loadAll();
  }

  clearFilters(): void {
    this.filters = {};
    this.loadAll();
  }

  /** Open settle modal for a teacher. */
  openSettleModal(summary: EnrichedDebtSummary): void {
    const teacher = this.teachers.find((t) => t.id === summary.teacherId);
    if (!teacher) return;
    this.settleTarget = { teacher, summary };
  }

  onSettled(): void {
    this.settleTarget = null;
    this.loadAll();
  }

  /** Inline WhatsApp notify from the table (itemized detail for this single row). */
  notifyTeacher(consumption: InternalConsumption): void {
    if (!consumption.teacher?.phoneNumber) return;

    const subtotal = consumption.unitCostPrice * consumption.quantity;
    const items = [
      {
        name: consumption.product.name,
        quantity: consumption.quantity,
        subtotal,
      },
    ];

    const url = this.service.buildItemizedWhatsAppUrl(
      consumption.teacher.phoneNumber,
      consumption.teacher.fullName,
      items,
      subtotal,
    );

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  onFormSaved(): void {
    this.showForm = false;
    this.loadAll();
  }

  trackById(_: number, item: InternalConsumption): string {
    return item.id;
  }
}
