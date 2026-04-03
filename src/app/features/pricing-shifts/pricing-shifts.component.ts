import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { PricingShiftsService } from '../../core/services/pricing-shifts.service';
import { PricingShift } from '../../core/models/pricing-shift.model';

@Component({
  selector: 'app-pricing-shifts',
  templateUrl: './pricing-shifts.component.html',
})
export class PricingShiftsComponent implements OnInit {

  readonly DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  readonly MINUTES = ['00', '30'];

  getHour(field: string): string   { return (this.form.get(field)?.value ?? '').split(':')[0] ?? ''; }
  getMinute(field: string): string { return (this.form.get(field)?.value ?? '').split(':')[1] ?? ''; }

  setTimePart(field: string, part: 'h' | 'm', value: string): void {
    const current: string = this.form.get(field)?.value ?? ':';
    const [h, m] = current.split(':');
    this.form.get(field)?.setValue(part === 'h' ? `${value}:${m || '00'}` : `${h || '00'}:${value}`);
    this.form.get(field)?.markAsTouched();
  }

  shifts: PricingShift[] = [];
  isLoading = false;
  serverError: string | null = null;

  // ─── Modal ────────────────────────────────────────────────────────────────
  showModal  = false;
  submitting = false;
  modalError: string | null = null;
  editingId: string | null = null;

  form!: FormGroup;

  // ─── Delete confirm ───────────────────────────────────────────────────────
  deletingId: string | null = null;
  deleteConfirmId: string | null = null;

  constructor(
    private service: PricingShiftsService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.loadShifts();
  }

  private buildForm(shift?: PricingShift): void {
    this.form = this.fb.group({
      name:                [shift?.name                ?? '',   [Validators.required, Validators.maxLength(100)]],
      startTime:           [shift?.startTime           ?? '',    Validators.required],
      endTime:             [shift?.endTime             ?? '',    Validators.required],
      price30min:          [shift?.price30min          ?? 0,    [Validators.required, Validators.min(0)]],
      price60min:          [shift?.price60min          ?? null, [Validators.required, Validators.min(0)]],
      price90min:          [shift?.price90min          ?? 0,    [Validators.required, Validators.min(0)]],
      price120min:         [shift?.price120min         ?? 0,    [Validators.required, Validators.min(0)]],
      teacherPricePerHour: [shift?.teacherPricePerHour ?? null, [Validators.required, Validators.min(0)]],
      isActive:            [shift?.isActive            ?? true],
    });
    // daysOfWeek managed manually (checkboxes)
    this.selectedDays = shift ? [...shift.daysOfWeek] : [];
  }

  selectedDays: number[] = [];

  toggleDay(day: number): void {
    const idx = this.selectedDays.indexOf(day);
    if (idx >= 0) {
      this.selectedDays.splice(idx, 1);
    } else {
      this.selectedDays.push(day);
    }
  }

  isDaySelected(day: number): boolean {
    return this.selectedDays.includes(day);
  }

  private loadShifts(): void {
    this.isLoading = true;
    this.serverError = null;
    this.service.getAll().subscribe({
      next: (data) => {
        this.shifts = data;
        this.isLoading = false;
      },
      error: () => {
        this.serverError = 'No se pudieron cargar las franjas horarias.';
        this.isLoading = false;
      },
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.modalError = null;
    this.buildForm();
    this.showModal = true;
  }

  openEdit(shift: PricingShift): void {
    this.editingId = shift.id;
    this.modalError = null;
    this.buildForm(shift);
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
    this.modalError = null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedDays.length === 0) {
      this.modalError = 'Seleccioná al menos un día de la semana.';
      return;
    }

    this.submitting = true;
    this.modalError = null;

    const value = this.form.getRawValue();
    const payload = {
      ...value,
      daysOfWeek:          [...this.selectedDays].sort((a, b) => a - b),
      price30min:          Number(value.price30min          ?? 0),
      price60min:          Number(value.price60min),
      price90min:          Number(value.price90min          ?? 0),
      price120min:         Number(value.price120min         ?? 0),
      teacherPricePerHour: Number(value.teacherPricePerHour ?? 0),
    };

    const request$ = this.editingId
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.closeModal();
        this.loadShifts();
      },
      error: (err) => {
        this.submitting = false;
        this.modalError = err?.error?.message ?? 'Ocurrió un error. Intentá de nuevo.';
      },
    });
  }

  toggleActive(shift: PricingShift): void {
    this.service.update(shift.id, { isActive: !shift.isActive }).subscribe({
      next: () => this.loadShifts(),
      error: () => {},
    });
  }

  requestDelete(id: string): void {
    this.deleteConfirmId = id;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  confirmDelete(): void {
    if (!this.deleteConfirmId) return;
    this.deletingId = this.deleteConfirmId;
    this.deleteConfirmId = null;
    this.service.delete(this.deletingId).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadShifts();
      },
      error: () => {
        this.deletingId = null;
      },
    });
  }

  get isFormReady(): boolean {
    return this.form.valid && this.selectedDays.length > 0;
  }

  hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl.hasError(error));
  }

  /** Formatea los días de la semana en un string legible: '1,2,3' → 'Lun, Mar, Mié'. */
  formatDays(days: number[]): string {
    return days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => this.DAY_LABELS[d])
      .join(', ');
  }

  fmt(value: number | string | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }
}
