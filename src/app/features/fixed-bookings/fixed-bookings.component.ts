import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, HostListener, signal, computed } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
import { NgClass, NgIf, NgFor, SlicePipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';
import { DisableScrollDirective } from '../../shared/directives/disable-scroll.directive';

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
  isTeacherClass: boolean;
  recurringDepositAmount: number | null;
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
  isTeacherClass: false,
  recurringDepositAmount: null,
});

@Component({
    selector: 'app-fixed-bookings',
    templateUrl: './fixed-bookings.component.html',
    imports: [
        NgClass,
        NgIf,
        NgFor,
        ReactiveFormsModule,
        FormsModule,
        ModalScrollLockDirective,
        DisableScrollDirective,
        SlicePipe,
        DecimalPipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedBookingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  fixedBookings = signal<FixedBooking[]>([]);
  courts = signal<Court[]>([]);
  teachers = signal<Teacher[]>([]);
  isLoading = signal(true);

  availableCourts = signal<{ id: string; name: string }[]>([]);

  readonly selectedCourtId$ = new BehaviorSubject<string>('');

  isSubmitting = signal(false);
  generatingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);

  isDialogOpen = signal(false);
  editingId = signal<string | null>(null);
  form: FormState = EMPTY_FORM();
  formError = signal('');

  searchTerm = '';
  filterDay = '';
  filterCourt = '';

  activeTab = signal<'lista' | 'grilla'>('grilla');
  private slotMap = new Map<string, SlotData>();
  selectedFixedBooking = signal<FixedBooking | null>(null);

  /** Cancha actualmente seleccionada (shortcut para el template). */
  get selectedCourtId(): string {
    return this.selectedCourtId$.value;
  }

  /** Cambia la cancha seleccionada y reconstruye el mapa de la grilla. */
  selectCourt(courtId: string): void {
    this.selectedCourtId$.next(courtId);
    this.buildGrid();
  }

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
    slots.push('00:00');
    slots.push('00:30');
    slots.push('01:00');
    return slots;
  })();

  /** Retorna los turnos fijos filtrados por searchTerm, día y cancha. */
  get filteredBookings(): FixedBooking[] {
    const term = this.searchTerm.trim().toLowerCase();
    const day = this.filterDay ? Number(this.filterDay) : null;
    const court = this.filterCourt || null;

    return this.fixedBookings().filter((item) => {
      if (term) {
        const nameMatch = item.clientName.toLowerCase().includes(term);
        const phoneMatch = (item.phoneNumber ?? '')
          .toLowerCase()
          .includes(term);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (day !== null && item.dayOfWeek !== day) return false;
      if (court && item.courtId !== court) return false;
      return true;
    });
  }

  /** Paleta de colores para el dot del pill (debe coincidir visualmente con COURT_COLORS). */
  private readonly COURT_DOT_COLORS: string[] = [
    'bg-indigo-400',
    'bg-violet-400',
    'bg-sky-400',
    'bg-teal-400',
    'bg-amber-400',
    'bg-rose-400',
  ];

  /** Devuelve la clase CSS de color asignada a una cancha, rotando la paleta. */
  courtColorClass(courtId: string): string {
    const idx = this.courts().findIndex((c) => c.id === courtId);
    return this.COURT_COLORS[Math.max(0, idx) % this.COURT_COLORS.length];
  }

  /** Devuelve la clase del dot de color para los pills del selector de cancha. */
  courtColorDot(courtId: string): string {
    const idx = this.availableCourts().findIndex((c) => c.id === courtId);
    return this.COURT_DOT_COLORS[
      Math.max(0, idx) % this.COURT_DOT_COLORS.length
    ];
  }

  /** Devuelve true si la cancha del turno está actualmente inactiva. */
  isCourtInactive(item: FixedBooking): boolean {
    return item.court != null && !item.court.isActive;
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

  /** El precio ahora lo gestiona el Motor de Precios Dinámico (franjas horarias). */
  getBookingPrice(_booking: FixedBooking): number | null {
    return null;
  }

  /** Abre el panel de detalle lateral para el turno fijo seleccionado. */
  openDetail(booking: FixedBooking): void {
    if (this.isCourtInactive(booking)) {
      this.toast.info(
        'Cancha inactiva',
        'No se puede editar un turno de una cancha inactiva.',
      );
      return;
    }
    this.selectedFixedBooking.set(booking);
  }

  /** Cierra el panel de detalle lateral. */
  closeDetail(): void {
    this.selectedFixedBooking.set(null);
  }

  /** Abre el diálogo de creación pre-poblado con día, hora y cancha desde la grilla. */
  openCreateFromGrid(day: number, hour: string): void {
    this.editingId.set(null);
    this.form = EMPTY_FORM();
    this.form.dayOfWeek = day;
    this.form.hour = hour;

    // Pre-selecciona la cancha actualmente visible en la grilla.
    // selectedCourtId$ es un BehaviorSubject: su valor es siempre sincrónico.
    const courtId = this.selectedCourtId$.value;
    if (courtId) {
      this.form.courtId = courtId;
    }

    this.onDayOfWeekChange();
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  constructor(
    private fixedSvc: FixedBookingsService,
    private courtsSvc: CourtsService,
    private toast: ToastService,
    private teachersSvc: TeachersService,
  ) {}

  ngOnInit(): void {
    this.courtsSvc.courts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((courts) => {
        this.courts.set(courts.filter((c) => c.isActive));
      });

    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  /** Cierra el modal o panel de detalle abierto al presionar Escape. */
  onEscape(): void {
    if (this.selectedFixedBooking()) {
      this.closeDetail();
      return;
    }
    if (this.isDialogOpen()) this.closeDialog();
  }

  /** Título del diálogo de formulario según si se está creando o editando. */
  dialogTitle = computed(() =>
    this.editingId() ? 'Editar Turno Fijo' : 'Nuevo Turno Fijo',
  );

  /** Devuelve el nombre del día de la semana a partir de su número (0=Domingo). */
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
    const isoToJs: Record<number, number> = {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 0,
    };
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

  /** Abre el diálogo de creación de turno fijo con el formulario vacío. */
  openCreateDialog(): void {
    this.editingId.set(null);
    this.form = EMPTY_FORM();
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  /** Abre el diálogo de edición pre-poblado con los datos del turno fijo. */
  openEditDialog(item: FixedBooking): void {
    this.editingId.set(item.id);
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
      isTeacherClass: !!item.teacherId,
      recurringDepositAmount: item.recurringDepositAmount ?? null,
    };
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  /** Cierra el diálogo de formulario y limpia el estado de edición. */
  closeDialog(): void {
    this.isDialogOpen.set(false);
    this.editingId.set(null);
  }

  /**
   * Se dispara al cambiar el toggle "¿Es clase con profesor?".
   * Si se desactiva, limpia el profesor y el nombre del cliente para
   * que el administrador ingrese un nombre libre.
   */
  onIsTeacherClassChange(): void {
    if (this.form.isTeacherClass) {
      this.form.durationMinutes = 60;
    } else {
      this.form.teacherId = '';
      this.form.clientName = '';
    }
  }

  /**
   * Al seleccionar un profesor, autocompleta clientName con el formato
   * estándar "Clase - Prof. {nombre}". Si se deselecciona, limpia el campo.
   */
  onTeacherSelectChange(teacherId: string): void {
    const teacher = this.teachers().find((t) => t.id === teacherId);
    this.form.clientName = teacher ? `Clase - Prof. ${teacher.fullName}` : '';
    this.form.phoneNumber = teacher?.phoneNumber ?? '';
  }

  /**
   * Valida el formulario y, si se está editando con cambios estructurales
   * (día, hora, duración o cancha), pide confirmación antes de aplicar
   * la cascada que regenera los turnos futuros.
   */
  submitForm(): void {
    if (!this.form.clientName.trim()) {
      this.formError.set('El nombre del cliente es obligatorio.');
      return;
    }
    if (!this.form.courtId) {
      this.formError.set('Debe seleccionar una cancha.');
      return;
    }
    if (!this.form.startDate) {
      this.formError.set('La fecha de inicio es obligatoria.');
      return;
    }

    this.formError.set('');

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
      recurringDepositAmount: this.form.recurringDepositAmount ?? undefined,
    };

    // Detectar si se modificó algún campo estructural en modo edición.
    const editingId = this.editingId();
    if (editingId) {
      const original = this.fixedBookings().find((f) => f.id === editingId);
      const hasStructuralChange =
        original &&
        (dto.dayOfWeek !== original.dayOfWeek ||
          dto.hour !== original.hour ||
          dto.durationMinutes !== original.durationMinutes ||
          dto.courtId !== original.courtId);

      if (hasStructuralChange) {
        Swal.fire({
          title: 'Modificar serie recurrente',
          html:
            `Cambiaste el <strong>día, hora, duración o cancha</strong> del turno fijo.<br><br>` +
            `Esto <strong>eliminará y regenerará</strong> todos los turnos futuros sin pago asociado.<br>` +
            `<span style="color:#d97706">Los turnos con seña o pago registrado no se tocarán.</span>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#4f46e5',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Sí, actualizar toda la serie',
          cancelButtonText: 'Cancelar',
          reverseButtons: true,
        }).then((result) => {
          if (result.isConfirmed) {
            this.executeUpdate(dto);
          }
        });
        return;
      }
    }

    this.executeUpdate(dto);
  }

  /** Envía la petición de creación o actualización al servicio. */
  private executeUpdate(dto: CreateFixedBookingDto): void {
    this.isSubmitting.set(true);

    const editingId = this.editingId();
    const op = editingId
      ? this.fixedSvc.update(editingId, dto)
      : this.fixedSvc.create(dto);

    op.subscribe({
      next: () => {
        this.toast.success(
          editingId ? 'Turno fijo actualizado' : 'Turno fijo creado',
          editingId
            ? 'Los cambios fueron guardados. Los turnos futuros fueron regenerados.'
            : 'Se generaron los turnos para las próximas 8 semanas.',
        );
        this.closeDialog();
        this.loadAll();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);

        if (err?.status === 409 && err?.error?.message === 'CONFLICT_OVERLAP') {
          const detail: string =
            err.error.detail ??
            'El horario solicitado se superpone con un turno fijo existente en esa cancha.';
          Swal.fire({
            title: 'Horario superpuesto',
            html: `No se puede guardar el turno fijo.<br><br>${detail}`,
            icon: 'error',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Entendido',
          });
          return;
        }

        // Solapamiento en la fecha de inicio → ofrecer semana siguiente.
        if (
          err?.status === 409 &&
          err?.error?.message === 'CONFLICT_START_DATE'
        ) {
          const nextDate: string = err.error.nextAvailableDate;
          const [year, month, day] = nextDate.split('-');
          const formatted = `${day}/${month}/${year}`;

          Swal.fire({
            title: 'Horario ocupado',
            html: `El horario seleccionado ya está ocupado para el día de hoy.<br><br>
                   ¿Desea que el turno fijo comience a partir de la semana siguiente
                   <strong>(${formatted})</strong>?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, usar esa fecha',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
          }).then((result) => {
            if (result.isConfirmed) {
              this.form.startDate = nextDate;
              const retryDto: CreateFixedBookingDto = {
                ...dto,
                startDate: nextDate,
              };
              this.executeUpdate(retryDto);
            }
          });
          return;
        }

        const msg =
          err?.error?.message ?? 'Error al guardar. Intente nuevamente.';
        this.formError.set(Array.isArray(msg) ? msg.join(' ') : msg);
      },
    });
  }

  /** Genera los próximos turnos individuales a partir del patrón semanal del turno fijo. */
  generateNext(item: FixedBooking): void {
    this.generatingId.set(item.id);
    this.fixedSvc.generateNext(item.id).subscribe({
      next: (res) => {
        this.toast.success(
          'Turnos generados',
          `Se crearon ${res.generated} turno(s) nuevo(s).`,
        );
        this.generatingId.set(null);
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron generar los turnos.');
        this.generatingId.set(null);
      },
    });
  }

  /** Confirma y elimina el turno fijo junto con todas sus reservas futuras asociadas. */
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

      this.deletingId.set(item.id);
      this.fixedSvc.deleteFixedBookingCascade(item.id).subscribe({
        next: (res) => {
          const detail =
            res.preserved > 0
              ? `${res.deleted} turno(s) borrado(s). ${res.preserved} conservado(s) por tener pago — revisalos en la agenda.`
              : `${res.deleted} turno(s) futuro(s) eliminado(s).`;
          this.toast.success(
            'Turno fijo eliminado',
            `${item.clientName} — ${detail}`,
          );
          this.deletingId.set(null);
          this.loadAll();
        },
        error: () => {
          this.toast.error('Error', 'No se pudo eliminar el turno fijo.');
          this.deletingId.set(null);
        },
      });
    });
  }

  /** Abre WhatsApp Web con un mensaje de recordatorio pre-cargado para el cliente. */
  whatsapp(item: FixedBooking): void {
    if (!item.phoneNumber) return;
    const phone = item.phoneNumber.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hola ${item.clientName}! Te recordamos tu turno fijo los días *${this.dayLabel(item.dayOfWeek)}* a las *${item.hour}hs* en La Caldera Padel. Queriamos saber si van a poder asistir esta semana. ¡Gracias!`,
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  /** Construye el mapa de slots de la grilla semanal filtrando por la cancha seleccionada. */
  private buildGrid(): void {
    this.slotMap.clear();
    const courtId = this.selectedCourtId$.value;
    for (const b of this.fixedBookings()) {
      if (!b.isActive) continue;
      if (courtId && b.courtId !== courtId) continue;
      const startIdx = this.validHours.indexOf(b.hour);
      if (startIdx === -1) continue;

      const rowSpan = Math.ceil(b.durationMinutes / 30);

      this.slotMap.set(`${b.dayOfWeek}-${b.hour}`, {
        booking: b,
        isStart: true,
        rowSpan,
      });

      for (let i = 1; i < rowSpan; i++) {
        const coveredIdx = startIdx + i;
        if (coveredIdx < this.validHours.length) {
          this.slotMap.set(`${b.dayOfWeek}-${this.validHours[coveredIdx]}`, {
            booking: b,
            isStart: false,
            rowSpan: 0,
          });
        }
      }
    }
  }

  /** Carga todos los turnos fijos, canchas y profesores en paralelo para inicializar la vista. */
  private loadAll(): void {
    this.isLoading.set(true);
    this.fixedSvc.findAll().subscribe({
      next: (data) => {
        this.fixedBookings.set(data);
        // Extrae canchas únicas presentes en los turnos, ordenadas por nombre.
        const seen = new Set<string>();
        const availableCourts = data
          .filter((b) => b.isActive && b.court)
          .reduce(
            (acc, b) => {
              if (!seen.has(b.courtId)) {
                seen.add(b.courtId);
                acc.push({ id: b.courtId, name: b.court.name });
              }
              return acc;
            },
            [] as { id: string; name: string }[],
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        this.availableCourts.set(availableCourts);

        // Selecciona la primera cancha disponible si no hay ninguna seleccionada.
        if (
          availableCourts.length > 0 &&
          !availableCourts.find((c) => c.id === this.selectedCourtId$.value)
        ) {
          this.selectedCourtId$.next(availableCourts[0].id);
        }

        this.buildGrid();
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar los turnos fijos.');
        this.isLoading.set(false);
      },
    });

    // courts se actualiza vía courts$ (suscripción en ngOnInit).
    this.courtsSvc.loadCourts();

    this.teachersSvc.findAll().subscribe({
      next: (data) => this.teachers.set(data),
      error: () => {},
    });
  }
}
