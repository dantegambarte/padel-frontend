import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { PricingShiftsService } from '../../core/services/pricing-shifts.service';
import { PricingShift } from '../../core/models/pricing-shift.model';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';
import { DisableScrollDirective } from '../../shared/directives/disable-scroll.directive';

@Component({
    selector: 'app-pricing-shifts',
    templateUrl: './pricing-shifts.component.html',
    imports: [
        NgIf,
        NgFor,
        NgClass,
        ModalScrollLockDirective,
        ReactiveFormsModule,
        DisableScrollDirective,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingShiftsComponent implements OnInit {
  readonly DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  readonly HOURS = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0'),
  );
  readonly MINUTES = ['00', '30'];

  /** Extrae la parte de horas del campo de tiempo del formulario reactivo. */
  getHour(field: string): string {
    return (this.form.get(field)?.value ?? '').split(':')[0] ?? '';
  }
  /** Extrae la parte de minutos del campo de tiempo del formulario reactivo. */
  getMinute(field: string): string {
    return (this.form.get(field)?.value ?? '').split(':')[1] ?? '';
  }

  /** Actualiza solo la hora o los minutos de un campo de tiempo sin reemplazar la otra parte. */
  setTimePart(field: string, part: 'h' | 'm', value: string): void {
    const current: string = this.form.get(field)?.value ?? ':';
    const [h, m] = current.split(':');
    this.form
      .get(field)
      ?.setValue(
        part === 'h' ? `${value}:${m || '00'}` : `${h || '00'}:${value}`,
      );
    this.form.get(field)?.markAsTouched();
  }

  shifts = signal<PricingShift[]>([]);
  isLoading = signal(false);
  serverError = signal<string | null>(null);

  showModal = signal(false);
  submitting = signal(false);
  modalError = signal<string | null>(null);
  editingId = signal<string | null>(null);

  form!: FormGroup;

  deletingId = signal<string | null>(null);
  deleteConfirmId = signal<string | null>(null);

  constructor(
    private service: PricingShiftsService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.loadShifts();
  }

  /** Inicializa el FormGroup con los valores de la franja a editar o con valores por defecto para creación. */
  private buildForm(shift?: PricingShift): void {
    this.form = this.fb.group({
      name: [
        shift?.name ?? '',
        [Validators.required, Validators.maxLength(100)],
      ],
      startTime: [shift?.startTime ?? '', Validators.required],
      endTime: [shift?.endTime ?? '', Validators.required],
      price30min: [
        shift?.price30min ?? 0,
        [Validators.required, Validators.min(0)],
      ],
      price60min: [
        shift?.price60min ?? null,
        [Validators.required, Validators.min(0)],
      ],
      price90min: [
        shift?.price90min ?? 0,
        [Validators.required, Validators.min(0)],
      ],
      price120min: [
        shift?.price120min ?? 0,
        [Validators.required, Validators.min(0)],
      ],
      teacherPricePerHour: [
        shift?.teacherPricePerHour ?? null,
        [Validators.required, Validators.min(0)],
      ],
      isActive: [shift?.isActive ?? true],
    });
    this.selectedDays.set(shift ? [...shift.daysOfWeek] : []);
  }

  selectedDays = signal<number[]>([]);

  /** Agrega o quita un día de la selección de días de la semana. */
  toggleDay(day: number): void {
    this.selectedDays.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  /** Devuelve true si el día dado está en la selección actual. */
  isDaySelected(day: number): boolean {
    return this.selectedDays().includes(day);
  }

  /** Carga todas las franjas horarias desde el servidor. */
  private loadShifts(): void {
    this.isLoading.set(true);
    this.serverError.set(null);
    this.service.getAll().subscribe({
      next: (data) => {
        this.shifts.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.serverError.set('No se pudieron cargar las franjas horarias.');
        this.isLoading.set(false);
      },
    });
  }

  /** Abre el modal de creación con el formulario vacío. */
  openCreate(): void {
    this.editingId.set(null);
    this.modalError.set(null);
    this.buildForm();
    this.showModal.set(true);
  }

  /** Abre el modal de edición pre-poblado con los datos de la franja seleccionada. */
  openEdit(shift: PricingShift): void {
    this.editingId.set(shift.id);
    this.modalError.set(null);
    this.buildForm(shift);
    this.showModal.set(true);
  }

  /** Cierra el modal y resetea el estado de edición y error. */
  closeModal(): void {
    this.showModal.set(false);
    this.editingId.set(null);
    this.modalError.set(null);
  }

  /** Valida el formulario y envía el payload de creación o actualización. */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedDays().length === 0) {
      this.modalError.set('Seleccioná al menos un día de la semana.');
      return;
    }

    this.submitting.set(true);
    this.modalError.set(null);

    const value = this.form.getRawValue();
    const payload = {
      ...value,
      daysOfWeek: [...this.selectedDays()].sort((a, b) => a - b),
      price30min: Number(value.price30min ?? 0),
      price60min: Number(value.price60min),
      price90min: Number(value.price90min ?? 0),
      price120min: Number(value.price120min ?? 0),
      teacherPricePerHour: Number(value.teacherPricePerHour ?? 0),
    };

    const editingId = this.editingId();
    const request$ = editingId
      ? this.service.update(editingId, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.loadShifts();
      },
      error: (err) => {
        this.submitting.set(false);
        this.modalError.set(
          err?.error?.message ?? 'Ocurrió un error. Intentá de nuevo.',
        );
      },
    });
  }

  /** Activa o desactiva una franja horaria sin abrir el modal completo. */
  toggleActive(shift: PricingShift): void {
    this.service.update(shift.id, { isActive: !shift.isActive }).subscribe({
      next: () => this.loadShifts(),
      error: () => {},
    });
  }

  /** Muestra el botón de confirmación de borrado para la franja indicada. */
  requestDelete(id: string): void {
    this.deleteConfirmId.set(id);
  }

  /** Cancela la confirmación de borrado pendiente. */
  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  /** Ejecuta el borrado definitivo de la franja previamente marcada. */
  confirmDelete(): void {
    const deleteConfirmId = this.deleteConfirmId();
    if (!deleteConfirmId) return;
    this.deletingId.set(deleteConfirmId);
    this.deleteConfirmId.set(null);
    this.service.delete(deleteConfirmId).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadShifts();
      },
      error: () => {
        this.deletingId.set(null);
      },
    });
  }

  /** True cuando el formulario es válido y hay al menos un día seleccionado. */
  get isFormReady(): boolean {
    return this.form.valid && this.selectedDays().length > 0;
  }

  /** True si el campo tocado tiene el error indicado. */
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

  /** Formatea un número al estilo local argentino. */
  fmt(value: number | string | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }
}
