import { Component, OnInit, HostListener } from '@angular/core';

import {
  FixedBookingsService,
  FixedBooking,
  CreateFixedBookingDto,
} from '../../core/services/fixed-bookings.service';
import { CourtsService } from '../../core/services/courts.service';
import { ToastService } from '../../core/services/toast.service';
import { Court } from '../../core/models/court.model';

type FormState = {
  clientName: string;
  phoneNumber: string;
  dayOfWeek: number;
  hour: string;
  durationMinutes: number;
  courtId: string;
  hasDeposit: boolean;
  startDate: string;
  notes: string;
};

const EMPTY_FORM = (): FormState => ({
  clientName: '',
  phoneNumber: '',
  dayOfWeek: 1,
  hour: '09:00',
  durationMinutes: 60,
  courtId: '',
  hasDeposit: false,
  startDate: new Date().toISOString().slice(0, 10),
  notes: '',
});

@Component({
  selector: 'app-fixed-bookings',
  templateUrl: './fixed-bookings.component.html',
})
export class FixedBookingsComponent implements OnInit {
  fixedBookings: FixedBooking[] = [];
  courts: Court[] = [];
  isLoading = true;
  isSubmitting = false;
  generatingId: string | null = null;
  deactivatingId: string | null = null;

  isDialogOpen = false;
  editingId: string | null = null;
  form: FormState = EMPTY_FORM();
  formError = '';

  // ── Filtros ──────────────────────────────────────────
  searchTerm = '';
  filterDay = '';
  filterCourt = '';

  readonly DAY_LABELS: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo',
  };

  readonly DAYS = [1, 2, 3, 4, 5, 6, 7];

  readonly DURATION_OPTIONS = [
    { value: 30, label: '30 min' },
    { value: 60, label: '60 min' },
    { value: 90, label: '90 min' },
    { value: 120, label: '120 min' },
  ];

  /** Slots válidos de 30 minutos entre 09:00 y 22:30. */
  readonly validHours: string[] = (() => {
    const slots: string[] = [];
    for (let h = 9; h < 23; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  })();

  /** Retorna los turnos fijos filtrados por searchTerm, día y cancha. */
  get filteredBookings(): FixedBooking[] {
    const term = this.searchTerm.trim().toLowerCase();
    const day  = this.filterDay  ? Number(this.filterDay)  : null;
    const court = this.filterCourt || null;

    return this.fixedBookings.filter((item) => {
      if (term) {
        const nameMatch  = item.clientName.toLowerCase().includes(term);
        const phoneMatch = (item.phoneNumber ?? '').toLowerCase().includes(term);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (day !== null && item.dayOfWeek !== day) return false;
      if (court && item.courtId !== court) return false;
      return true;
    });
  }

  constructor(
    private fixedSvc: FixedBookingsService,
    private courtsSvc: CourtsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  get dialogTitle(): string {
    return this.editingId ? 'Editar Turno Fijo' : 'Nuevo Turno Fijo';
  }

  dayLabel(d: number): string {
    return this.DAY_LABELS[d] ?? `Día ${d}`;
  }

  /**
   * Se dispara cuando el usuario cambia el día de la semana en el formulario.
   * Calcula el próximo día que coincide con la selección y actualiza `form.startDate`.
   * Si hoy ya es ese día, deja la fecha en hoy mismo.
   * Usa componentes locales (getFullYear/getMonth/getDate) para evitar el
   * desfase de UTC-3 que produce `toISOString()` pasada la medianoche.
   */
  onDayOfWeekChange(): void {
    // Mapeo ISO (1=Lun…7=Dom) → JS getDay() (0=Dom, 1=Lun…6=Sáb)
    const isoToJs: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };
    const target = isoToJs[Number(this.form.dayOfWeek)];
    if (target === undefined) return;

    const today = new Date();
    let daysToAdd = target - today.getDay();
    if (daysToAdd < 0) daysToAdd += 7;

    const next = new Date(today);
    next.setDate(today.getDate() + daysToAdd);

    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    this.form.startDate = `${y}-${m}-${d}`;
  }

  openCreateDialog(): void {
    this.editingId = null;
    this.form = EMPTY_FORM();
    this.formError = '';
    this.isDialogOpen = true;
  }

  openEditDialog(item: FixedBooking): void {
    this.editingId = item.id;
    this.form = {
      clientName: item.clientName,
      phoneNumber: item.phoneNumber ?? '',
      dayOfWeek: item.dayOfWeek,
      hour: item.hour,
      durationMinutes: item.durationMinutes,
      courtId: item.courtId,
      hasDeposit: item.hasDeposit,
      startDate: item.startDate,
      notes: item.notes ?? '',
    };
    this.formError = '';
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
    this.editingId = null;
  }

  submitForm(): void {
    if (!this.form.clientName.trim()) {
      this.formError = 'El nombre del cliente es obligatorio.';
      return;
    }
    if (!this.form.courtId) {
      this.formError = 'Debe seleccionar una cancha.';
      return;
    }
    if (!this.form.startDate) {
      this.formError = 'La fecha de inicio es obligatoria.';
      return;
    }

    this.formError = '';
    this.isSubmitting = true;

    const dto: CreateFixedBookingDto = {
      clientName: this.form.clientName.trim(),
      phoneNumber: this.form.phoneNumber.trim() || undefined,
      dayOfWeek: this.form.dayOfWeek,
      hour: this.form.hour,
      durationMinutes: this.form.durationMinutes,
      courtId: this.form.courtId,
      hasDeposit: this.form.hasDeposit,
      startDate: this.form.startDate,
      notes: this.form.notes.trim() || undefined,
    };

    const op = this.editingId
      ? this.fixedSvc.update(this.editingId, dto)
      : this.fixedSvc.create(dto);

    op.subscribe({
      next: () => {
        this.toast.success(
          this.editingId ? 'Turno fijo actualizado' : 'Turno fijo creado',
          this.editingId
            ? 'Los cambios fueron guardados.'
            : 'Se generaron los turnos para las próximas 8 semanas.',
        );
        this.closeDialog();
        this.loadAll();
        this.isSubmitting = false;
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error al guardar. Intente nuevamente.';
        this.formError = Array.isArray(msg) ? msg.join(' ') : msg;
        this.isSubmitting = false;
      },
    });
  }

  generateNext(item: FixedBooking): void {
    this.generatingId = item.id;
    this.fixedSvc.generateNext(item.id).subscribe({
      next: (res) => {
        this.toast.success(
          'Turnos generados',
          `Se crearon ${res.generated} turno(s) nuevo(s).`,
        );
        this.generatingId = null;
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron generar los turnos.');
        this.generatingId = null;
      },
    });
  }

  deactivate(item: FixedBooking): void {
    this.deactivatingId = item.id;
    this.fixedSvc.deactivate(item.id).subscribe({
      next: () => {
        this.toast.success('Turno fijo desactivado', item.clientName);
        this.deactivatingId = null;
        this.loadAll();
      },
      error: () => {
        this.toast.error('Error', 'No se pudo desactivar el turno fijo.');
        this.deactivatingId = null;
      },
    });
  }

  reactivate(item: FixedBooking): void {
    this.fixedSvc.update(item.id, { isActive: true }).subscribe({
      next: () => {
        this.toast.success('Turno fijo reactivado', item.clientName);
        this.loadAll();
      },
      error: () => {
        this.toast.error('Error', 'No se pudo reactivar el turno fijo.');
      },
    });
  }

  whatsapp(item: FixedBooking): void {
    if (!item.phoneNumber) return;
    const phone = item.phoneNumber.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${item.clientName}! Te recordamos tu turno fijo los días ${this.dayLabel(item.dayOfWeek)} a las ${item.hour}hs en La Caldera. Queriamos saber si van a poder asistir esta semana. ¡Gracias!`,
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  private loadAll(): void {
    this.isLoading = true;
    this.fixedSvc.findAll().subscribe({
      next: (data) => {
        this.fixedBookings = data;
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar los turnos fijos.');
        this.isLoading = false;
      },
    });

    this.courtsSvc.findAll().subscribe({
      next: (data) => (this.courts = data.filter((c) => c.isActive)),
      error: () => {},
    });
  }
}
