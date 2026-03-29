import { Component, OnInit, HostListener } from '@angular/core';
import Swal from 'sweetalert2';

import {
  FixedBookingsService,
  FixedBooking,
  CreateFixedBookingDto,
} from '../../core/services/fixed-bookings.service';
import { CourtsService } from '../../core/services/courts.service';
import { ToastService } from '../../core/services/toast.service';
import { TeachersService } from '../../core/services/teachers.service';
import { Court } from '../../core/models/court.model';
import { Teacher } from '../../core/models/teacher.model';

/** Dato de una celda de la grilla semanal. */
type SlotData = {
  booking: FixedBooking;
  /** true = aquí empieza el turno (se renderiza); false = cubierta por span */
  isStart: boolean;
  /** Cantidad de filas de 30 min que debe abarcar la celda. */
  rowSpan: number;
};

type FormState = {
  clientName: string;
  phoneNumber: string;
  dayOfWeek: number;
  hour: string;
  durationMinutes: number;
  courtId: string;
  startDate: string;
  notes: string;
  teacherId: string;
};

const EMPTY_FORM = (): FormState => ({
  clientName: '',
  phoneNumber: '',
  dayOfWeek: 1,
  hour: '09:00',
  durationMinutes: 60,
  courtId: '',
  startDate: new Date().toISOString().slice(0, 10),
  notes: '',
  teacherId: '',
});

@Component({
  selector: 'app-fixed-bookings',
  templateUrl: './fixed-bookings.component.html',
})
export class FixedBookingsComponent implements OnInit {
  fixedBookings: FixedBooking[] = [];
  courts: Court[] = [];
  teachers: Teacher[] = [];
  isLoading = true;
  isSubmitting = false;
  generatingId: string | null = null;
  deletingId: string | null = null;

  isDialogOpen = false;
  editingId: string | null = null;
  form: FormState = EMPTY_FORM();
  formError = '';

  // ── Filtros ──────────────────────────────────────────
  searchTerm = '';
  filterDay = '';
  filterCourt = '';

  // ── Vista ─────────────────────────────────────────────
  activeTab: 'lista' | 'grilla' = 'lista';
  private slotMap = new Map<string, SlotData>();
  selectedFixedBooking: FixedBooking | null = null;

  /** Paleta de colores por cancha (clases completas para que Tailwind las incluya). */
  readonly COURT_COLORS: string[] = [
    'bg-indigo-50 border-indigo-400 text-indigo-900',
    'bg-violet-50 border-violet-400 text-violet-900',
    'bg-sky-50 border-sky-400 text-sky-900',
    'bg-teal-50 border-teal-400 text-teal-900',
    'bg-amber-50 border-amber-400 text-amber-900',
    'bg-rose-50 border-rose-400 text-rose-900',
  ];

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

  /** Slots válidos de 30 minutos: 09:00 → 23:30, luego 00:00 → 01:00 (madrugada). */
  readonly validHours: string[] = (() => {
    const slots: string[] = [];
    for (let h = 9; h < 24; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    // Madrugada
    slots.push('00:00');
    slots.push('00:30');
    slots.push('01:00');
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

  /** Devuelve la clase CSS de color asignada a una cancha, rotando la paleta. */
  courtColorClass(courtId: string): string {
    const idx = this.courts.findIndex(c => c.id === courtId);
    return this.COURT_COLORS[Math.max(0, idx) % this.COURT_COLORS.length];
  }

  /** Devuelve el dato de la celda (inicio o cobertura de span) o undefined si está libre. */
  getSlotData(day: number, hour: string): SlotData | undefined {
    return this.slotMap.get(`${day}-${hour}`);
  }

  /** Hora de fin calculada a partir de la hora de inicio y duración. */
  getEndHour(booking: FixedBooking): string {
    const [h, m] = booking.hour.split(':').map(Number);
    const total = h * 60 + m + booking.durationMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  /** Precio del turno según la cancha y la duración. */
  getBookingPrice(booking: FixedBooking): number | null {
    const court = this.courts.find(c => c.id === booking.courtId);
    if (!court) return null;
    const map: Record<number, number> = {
      30: court.price30, 60: court.price60,
      90: court.price90, 120: court.price120,
    };
    return map[booking.durationMinutes] ?? null;
  }

  openDetail(booking: FixedBooking): void {
    this.selectedFixedBooking = booking;
  }

  closeDetail(): void {
    this.selectedFixedBooking = null;
  }

  /** Abre el diálogo de creación pre-poblado con día y hora desde la grilla. */
  openCreateFromGrid(day: number, hour: string): void {
    this.editingId = null;
    this.form = EMPTY_FORM();
    this.form.dayOfWeek = day;
    this.form.hour = hour;
    this.onDayOfWeekChange();
    this.formError = '';
    this.isDialogOpen = true;
  }

  constructor(
    private fixedSvc: FixedBookingsService,
    private courtsSvc: CourtsService,
    private toast: ToastService,
    private teachersSvc: TeachersService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedFixedBooking) { this.closeDetail(); return; }
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
      startDate: item.startDate,
      notes: item.notes ?? '',
      teacherId: item.teacherId ?? '',
    };
    this.formError = '';
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
    this.editingId = null;
  }

  /** Al seleccionar un profesor, autocompleta el nombre del cliente. */
  onTeacherSelectChange(teacherId: string): void {
    const teacher = this.teachers.find((t) => t.id === teacherId);
    this.form.clientName = teacher ? `Clase - ${teacher.fullName}` : '';
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
      startDate: this.form.startDate,
      notes: this.form.notes.trim() || undefined,
      teacherId: this.form.teacherId || null,
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

  deleteCascade(item: FixedBooking): void {
    Swal.fire({
      title: '¡Advertencia! Borrado Permanente',
      html: `Estás a punto de borrar el turno fijo de <strong>${item.clientName}</strong>.<br><br>
             Esto eliminará <strong>todas</strong> las reservas individuales asociadas
             a este turno fijo desde hoy en adelante.<br><br>
             <span style="color:#dc2626;">Esta operación no se puede deshacer.</span>
             ¿Deseas continuar?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, borrar permanentemente',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.deletingId = item.id;
      this.fixedSvc.deleteFixedBookingCascade(item.id).subscribe({
        next: (res) => {
          this.toast.success(
            'Turno fijo eliminado',
            `${item.clientName} — ${res.deleted} reserva(s) futura(s) borrada(s).`,
          );
          this.deletingId = null;
          this.loadAll();
        },
        error: () => {
          this.toast.error('Error', 'No se pudo eliminar el turno fijo.');
          this.deletingId = null;
        },
      });
    });
  }

  whatsapp(item: FixedBooking): void {
    if (!item.phoneNumber) return;
    const phone = item.phoneNumber.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${item.clientName}! Te recordamos tu turno fijo los días *${this.dayLabel(item.dayOfWeek)}* a las *${item.hour}hs* en La Caldera Padel. Queriamos saber si van a poder asistir esta semana. ¡Gracias!`,
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  private buildGrid(): void {
    this.slotMap.clear();
    for (const b of this.fixedBookings) {
      if (!b.isActive) continue;
      const startIdx = this.validHours.indexOf(b.hour);
      if (startIdx === -1) continue;

      const rowSpan = Math.ceil(b.durationMinutes / 30);

      // Celda de inicio: se renderiza con span
      this.slotMap.set(`${b.dayOfWeek}-${b.hour}`, { booking: b, isStart: true, rowSpan });

      // Celdas cubiertas: se omiten en la grilla para no romper el layout
      for (let i = 1; i < rowSpan; i++) {
        const coveredIdx = startIdx + i;
        if (coveredIdx < this.validHours.length) {
          this.slotMap.set(`${b.dayOfWeek}-${this.validHours[coveredIdx]}`, {
            booking: b, isStart: false, rowSpan: 0,
          });
        }
      }
    }
  }

  private loadAll(): void {
    this.isLoading = true;
    this.fixedSvc.findAll().subscribe({
      next: (data) => {
        this.fixedBookings = data;
        this.buildGrid();
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

    this.teachersSvc.findAll().subscribe({
      next: (data) => (this.teachers = data),
      error: () => {},
    });
  }
}
