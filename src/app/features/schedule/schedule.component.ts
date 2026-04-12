import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  NgZone,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, forkJoin, timer, of } from 'rxjs';
import {
  finalize,
  filter,
  take,
  catchError,
  debounceTime,
} from 'rxjs/operators';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { CourtsService } from '../../core/services/courts.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ProductsService } from '../../core/services/products.service';
import { ToastService } from '../../core/services/toast.service';
import { NotificationService } from '../../core/services/notification.service';
import { FixedBookingsService } from '../../core/services/fixed-bookings.service';
import { TeachersService } from '../../core/services/teachers.service';
import { CashService } from '../../core/services/cash.service';
import { DraftService } from '../../core/services/draft.service';
import Swal from 'sweetalert2';
import { CalculatorService } from '../../core/services/calculator.service';
import { PricingShiftsService } from '../../core/services/pricing-shifts.service';
import { PricingShift } from '../../core/models/pricing-shift.model';
import { HolidayService } from '../../core/services/holiday.service';

import { Court } from '../../core/models/court.model';
import { Product } from '../../core/models/product.model';
import { Teacher } from '../../core/models/teacher.model';
import {
  BookingResponse,
  BookingPayment,
  BookingStatus,
  PriceType,
  CreateBookingDto,
  UpdateBookingDto,
  RescheduleBookingDto,
} from '../../core/models/booking.model';

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** `true` cuando este ítem fue incluido en un "Registrar Pago" confirmado. */
  isPaid?: boolean;
  /** `true` cuando el cajero marcó este ítem para incluirlo en el cobro actual. */
  selectedForPayment?: boolean;
  /**
   * `true` cuando el ítem fue comprometido localmente al registrar el pago de un
   * jugador en modo "Dividir por Jugador", pero aún NO fue guardado en la base de datos.
   * Se usa para ocultarlo del panel de consumos del siguiente jugador sin mostrarlo
   * como "✓ Pagado" en el panel izquierdo antes de confirmar con "Registrar Pago".
   */
  committedBySplit?: boolean;
}

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
})
export class ScheduleComponent implements OnInit, OnDestroy {
  selectedDate = (() => {
    const d = new Date();
    if (d.getHours() < 2) {
      d.setDate(d.getDate() - 1);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  courts: Court[] = [];
  allProducts: Product[] = [];
  teachers: Teacher[] = [];
  pricingShifts: PricingShift[] = [];
  isTeacherBooking = false;
  selectedTeacherId: string | null = null;

  /** Productos marcados como destacados, disponibles para agregar rápidamente. */
  get featuredProducts(): Product[] {
    return this.allProducts.filter(
      (p) =>
        p.isFeatured &&
        (p.stock > 0 ||
          (p.category?.name ?? '').toLowerCase().includes('alquiler')),
    );
  }
  isLoading = false;
  loadError = '';

  bookingMap = new Map<string, BookingResponse>();

  horarioApertura = '09:00';
  horarioCierre = '23:00';

  /** Slots de 30 minutos generados dinámicamente según horario de apertura/cierre. */
  HOURS: string[] = this.buildHoursFromRange('09:00', '23:00');

  /** Genera slots de 30 min desde apertura hasta (sin incluir) cierre, con soporte post-medianoche. */
  private buildHoursFromRange(apertura: string, cierre: string): string[] {
    const [oh, om] = apertura.split(':').map(Number);
    const [ch, cm] = cierre.split(':').map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    const totalMin =
      closeMin > openMin ? closeMin - openMin : 24 * 60 - openMin + closeMin;
    const slots: string[] = [];
    for (let i = 0; i < totalMin; i += 30) {
      const abs = (openMin + i) % (24 * 60);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      slots.push(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
      );
    }
    return slots;
  }

  readonly DURATION_OPTIONS = [
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1:30 hs' },
    { value: 120, label: '2 hs' },
  ];

  durationMinutes = 60;

  isDialogOpen = false;
  isSaving = false;
  isSavingDetail = false;
  isConfirmingBooking = false;

  dialogMode: 'create' | 'detail' = 'create';

  selectedSlot: { court: Court; hour: string } | null = null;
  selectedBooking: BookingResponse | null = null;

  clientName = '';
  phoneNumber = '';
  priceType: PriceType = 'standard';
  isFixedBookingMode = false;
  cart: CartItem[] = [];
  pagoEfectivo = 0;
  pagoTransferencia = 0;
  productSearch = '';
  searchResults: Product[] = [];

  detailCart: CartItem[] = [];
  detailAmountCash = 0;
  detailAmountTransfer = 0;
  detailPlayerCount = 4;
  detailPaidCount = 0;
  readonly MAX_PLAYERS = 12;
  detailProductSearch = '';
  detailSearchResults: Product[] = [];
  isAutoSavingItems = false;
  /** Verdadero cuando al menos un ítem del carrito está tildado para cobro parcial. */
  get hasSelectedProducts(): boolean {
    return this.detailCart.some((i) => !i.isPaid && i.selectedForPayment);
  }
  /** Cantidad de ítems (líneas) del carrito tildados para cobro parcial. */
  get selectedProductsCount(): number {
    return this.detailCart.filter((i) => !i.isPaid && i.selectedForPayment)
      .length;
  }
  /** Total de los productos tildados para cobro parcial. Calculado en tiempo real. */
  get pendingProductPaymentAmount(): number {
    return this.detailCart
      .filter((i) => !i.isPaid && i.selectedForPayment)
      .reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
  }

  /** Tab activo en el panel de cobro del modal de detalle: pago rápido o dividir por jugador. */
  detailPaymentTab: 'quick' | 'split' = 'quick';
  /** Método seleccionado en el panel "Cobrar producto" antes de confirmar. null = sin selección. */
  pendingProductPaymentMethod: 'cash' | 'transfer' | null = null;

  @ViewChild('dialogScrollBody') dialogScrollBody!: ElementRef<HTMLDivElement>;
  @ViewChild('cobroParcialPanel')
  cobroParcialPanel!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('headerRow') headerRow!: ElementRef<HTMLDivElement>;

  private isScrollDragging = false;
  private scrollDragStartX = 0;
  private scrollDragOriginLeft = 0;

  confirmDialogOpen = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  private confirmCallback: (() => void) | null = null;

  /** Turno pendiente de mover/duplicar (drag-drop o botón móvil). */
  rescheduleDialogOpen = false;
  /** `true` cuando el diálogo es iniciado desde el botón móvil dentro del modal de detalle. */
  rescheduleFromModal = false;
  /**
   * `true` durante el ciclo completo de un drag (desde cdkDragStarted hasta cdkDragEnded).
   * Usado para bloquear `onSlotClick` y evitar que el click sintético del drop
   * abra accidentalmente el modal de crear/ver turno.
   */
  isDragging = false;
  rescheduleTargetCourtId = '';
  rescheduleTargetDate = '';
  rescheduleTargetHour = '';
  /** ID del turno que se está reposicionando. */
  private rescheduleSourceId = '';
  isRescheduling = false;

  private savedAmountCash = 0;
  private savedAmountTransfer = 0;
  /** Contador de pagados al abrir el modal — usado para el dirty check al cerrar. */
  private initialPaidCount = 0;
  /** Historial de pagos por jugador en la sesión actual del modal (LIFO para deshacer). */
  private playerPaymentHistory: {
    method: 'cash' | 'transfer';
    amount: number;
    committedIndices: number[];
    /** Snapshot del carrito antes de commitear, para restaurar exactamente al deshacer. */
    cartSnapshot: CartItem[];
  }[] = [];
  /** Contadores por método para el deshacer selectivo. */
  partialCashCount = 0;
  partialTransferCount = 0;

  /**
   * Índices del detailCart seleccionados individualmente para incluir en el
   * pago del jugador actual en la pestaña "Dividir por Jugador".
   * Se vacía automáticamente después de registrar cada pago.
   */
  /**
   * Claves de unidades seleccionadas para el jugador actual.
   * Formato: "cartIdx:unitIdx" — permite seleccionar unidades individuales
   * de un ítem con quantity > 1 (ej. "0:0" y "0:1" para 2 aguas en index 0).
   */
  selectedConsumableKeys = new Set<string>();

  /**
   * Vista "plana" del carrito: cada unidad de cada ítem impago como una entrada separada.
   * Permite asignar individualmente cada unidad a un jugador distinto.
   * La key usa productId + contador global para ser única y estable (no depende del orden del carrito).
   */
  get flatUnpaidConsumables(): {
    key: string;
    cartIdx: number;
    unitIdx: number;
    name: string;
    unitPrice: number;
    committed: boolean;
  }[] {
    const result: {
      key: string;
      cartIdx: number;
      unitIdx: number;
      name: string;
      unitPrice: number;
      committed: boolean;
    }[] = [];
    const productCounter = new Map<string, number>();

    for (let cartIdx = 0; cartIdx < this.detailCart.length; cartIdx++) {
      const item = this.detailCart[cartIdx];

      if (item.isPaid && !item.committedBySplit) continue;

      for (let unitIdx = 0; unitIdx < item.quantity; unitIdx++) {
        const globalUnitIdx = productCounter.get(item.productId) ?? 0;
        productCounter.set(item.productId, globalUnitIdx + 1);

        const key = `${item.productId}:${globalUnitIdx}`;

        result.push({
          key,
          cartIdx,
          unitIdx,
          name: item.name,
          unitPrice: Number(item.unitPrice),
          committed: item.committedBySplit === true,
        });
      }
    }
    return result;
  }

  /** Total de los consumos seleccionados individualmente para el jugador actual. */
  get selectedConsumablesTotal(): number {
    let total = 0;
    for (const unit of this.flatUnpaidConsumables) {
      if (!unit.committed && this.selectedConsumableKeys.has(unit.key)) {
        total += unit.unitPrice;
      }
    }
    return total;
  }

  /**
   * Monto total que pagará el jugador actual.
   * - En modo 'court': cuota fija de cancha + consumos seleccionados individualmente.
   * - En modo 'court+items': cuota proporcional de cancha + todos los consumos pendientes.
   */
  get currentPlayerTotal(): number {
    if (this.splitMode === 'court+items') {
      return this.detailCostPerPlayer;
    }
    return this.baseCanchaSplit + this.selectedConsumablesTotal;
  }

  /** Alterna la selección de una unidad individual de consumo para el pago del jugador actual. */
  toggleConsumableUnit(key: string): void {
    const next = new Set(this.selectedConsumableKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedConsumableKeys = next;
    // Sincronizar selectedForPayment usando flatUnpaidConsumables para obtener el cartIdx correcto
    const flat = this.flatUnpaidConsumables;
    const unit = flat.find((u) => u.key === key);
    if (unit) {
      const cartIdx = unit.cartIdx;
      const anyUnitSelected = flat.some(
        (u) => u.cartIdx === cartIdx && this.selectedConsumableKeys.has(u.key),
      );
      this.detailCart = this.detailCart.map((item, i) =>
        i === cartIdx ? { ...item, selectedForPayment: anyUnitSelected } : item,
      );
    }
  }

  /**
   * Modo de división: 'court' divide solo el precio de cancha,
   * 'court+items' divide cancha + consumos pendientes de pago.
   */
  splitMode: 'court' | 'court+items' = 'court+items';

  /**
   * Cambia el modo de división. Si hay pagos parciales de la sesión sin guardar,
   * los descarta porque sus montos son específicos del modo anterior y serían
   * inconsistentes al deshacer. Los montos ya persistidos en DB se preservan.
   */
  setSplitMode(mode: 'court' | 'court+items'): void {
    if (mode === 'court+items' && !this.hasUnpaidItems) mode = 'court';
    if (this.splitMode === mode) return;
    if (this.playerPaymentHistory.length > 0) {
      let cashFromButtons = 0;
      let transferFromButtons = 0;
      for (const p of this.playerPaymentHistory) {
        if (p.method === 'cash') cashFromButtons += p.amount;
        else transferFromButtons += p.amount;
      }
      this.detailAmountCash = Math.max(
        0,
        (Number(this.detailAmountCash) || 0) - cashFromButtons,
      );
      this.detailAmountTransfer = Math.max(
        0,
        (Number(this.detailAmountTransfer) || 0) - transferFromButtons,
      );
      this.playerPaymentHistory = [];
      this.partialCashCount = 0;
      this.partialTransferCount = 0;
      this.detailPaidCount = this.initialPaidCount;
    }
    this.selectedConsumableKeys = new Set();
    this.splitMode = mode;
  }

  /** IDs de reservas para las que ya se emitió el recordatorio de inicio tardío. */
  private notifiedBookingIds = new Set<string>();

  private sub = new Subscription();

  /**
   * Estado de la caja en tiempo real.
   * Default `true` (optimista) para no bloquear el panel si la red tarda.
   * Se actualiza en `ngOnInit` con la respuesta real del servidor.
   */
  isCashRegisterOpen = true;

  /** Draft de creación de reserva. */
  showBookingDraftBanner = false;
  private readonly DRAFT_KEY_BOOKING = 'draft_booking_create';
  private bookingDraftSave$ = new Subject<void>();

  /** Auto-save de cantidad de jugadores: emite el nuevo valor con debounce. */
  private playerCountSave$ = new Subject<number>();
  isSavingPlayerCount = false;

  constructor(
    private authService: AuthService,
    private courtsService: CourtsService,
    private bookingsService: BookingsService,
    private productsService: ProductsService,
    private configService: ConfigService,
    private toast: ToastService,
    private notificationService: NotificationService,
    public calcService: CalculatorService,
    private zone: NgZone,
    private route: ActivatedRoute,
    private fixedBookingsService: FixedBookingsService,
    private teachersService: TeachersService,
    private cashService: CashService,
    private router: Router,
    private pricingShiftsService: PricingShiftsService,
    private draftService: DraftService,
    public holidayService: HolidayService,
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.startReminderTimer();
    this.listenToDateQueryParam();
    this.checkCashStatus();

    this.sub.add(
      this.bookingsService.bookingUpdated$.subscribe((updated) => {
        if (updated.date !== this.selectedDate) return;

        this.addToBookingMap(updated);

        if (this.selectedBooking?.id === updated.id) {
          this.selectedBooking = updated;
        }
      }),
    );

    this.sub.add(
      this.bookingDraftSave$.pipe(debounceTime(500)).subscribe(() => {
        this.draftService.saveDraft(this.DRAFT_KEY_BOOKING, {
          clientName: this.clientName,
          phoneNumber: this.phoneNumber,
          priceType: this.priceType,
          durationMinutes: this.durationMinutes,
          pagoEfectivo: this.pagoEfectivo,
          pagoTransferencia: this.pagoTransferencia,
        });
      }),
    );

    this.sub.add(
      this.playerCountSave$.pipe(debounceTime(400)).subscribe((count) => {
        if (!this.selectedBooking) return;
        this.isSavingPlayerCount = true;
        this.bookingsService
          .update(this.selectedBooking.id, { playerCount: count })
          .subscribe({
            next: (updated) => {
              this.addToBookingMap(updated);
              this.selectedBooking = updated;
            },
            complete: () => (this.isSavingPlayerCount = false),
          });
      }),
    );
  }

  /**
   * Consulta el estado de la caja al montar el componente.
   * Reutiliza el caché de 10 s de CashService para no generar peticiones extras.
   */
  private checkCashStatus(): void {
    this.sub.add(
      this.cashService.getCurrent().subscribe({
        next: (cash) => {
          this.isCashRegisterOpen = !cash.isClosed && !cash.noSession;
        },
        error: () => {
          this.isCashRegisterOpen = true;
        },
      }),
    );
  }

  /**
   * Escucha los query params `date` y `openBooking` del Topbar.
   * - `date` mueve la grilla a esa fecha y recarga los turnos.
   * - `openBooking` marca un ID de turno para abrirlo automáticamente
   *   tras la siguiente carga; si la fecha ya está activa, lo abre de inmediato.
   */
  private listenToDateQueryParam(): void {
    this.sub.add(
      this.route.queryParams
        .pipe(filter((params) => !!params['date'] || !!params['openBooking']))
        .subscribe((params) => {
          const date: string = params['date'];
          const openBookingId: string | undefined = params['openBooking'];

          if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            this.selectedDate = date;
          }

          this.loadBookings(() => {
            if (openBookingId) {
              this.tryOpenBookingById(openBookingId);
            }
          });
        }),
    );
  }

  /** Busca un turno en el bookingMap por ID, abre su modal y hace scroll hacia su fila. */
  private tryOpenBookingById(id: string): void {
    for (const booking of this.bookingMap.values()) {
      if (booking.id === id && booking.court) {
        this.openDetailDialog(booking.court, booking.hour, booking);
        this.scrollToTime(booking.hour);
        return;
      }
    }
  }

  /** Hace scroll suave hacia la fila de la hora indicada en la grilla.
   *  Si el elemento aún no está en el DOM (canchas todavía cargando),
   *  reintenta automáticamente hasta 8 veces con 400 ms de intervalo. */
  scrollToTime(timeStr: string, attempt = 0): void {
    if (!timeStr) return;
    const cleanTime = timeStr.replace('hs', '').trim();
    const targetId = `time-row-${cleanTime}`;
    setTimeout(
      () => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempt < 8) {
          this.scrollToTime(timeStr, attempt + 1);
        }
      },
      attempt === 0 ? 300 : 400,
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /**
   * Navega a la pantalla de configuración de canchas. El operador puede usar esta ruta para resolver rápidamente cualquier inconsistencia de canchas (ej. cancha asignada a reserva pero luego desactivada) sin perder el contexto del día ni la hora que estaba viendo.
   */
  goToCourtSettings(): void {
    this.router.navigate(['/app/settings']);
  }

  /**
   * Inicia un timer que evalúa cada 60 s si hay turnos con estado 'booked'
   * que ya deberían haber comenzado (≥ 5 min de retraso).
   * La suscripción se agrega a `this.sub` para destruirse en ngOnDestroy.
   */
  private startReminderTimer(): void {
    this.sub.add(
      timer(0, 60_000).subscribe(() => this.checkBookingReminders()),
    );
  }

  /**
   * Itera el bookingMap buscando reservas en estado 'booked' del día actual
   * que tienen entre 5 y 120 minutos de retraso (ventana de 2 horas).
   * Agrupa TODOS los turnos nuevos encontrados en un ÚNICO toast para evitar spam.
   * Cada reserva se marca en `notifiedBookingIds` para no repetir la alerta.
   */
  private checkBookingReminders(): void {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (this.selectedDate !== todayStr) return;

    const nowMin = today.getHours() * 60 + today.getMinutes();
    const processed = new Set<string>();
    const newlyLate: string[] = [];

    this.bookingMap.forEach((booking) => {
      if (processed.has(booking.id)) return;
      processed.add(booking.id);

      if (booking.status !== 'booked') return;
      if (this.notifiedBookingIds.has(booking.id)) return;

      const [h, m] = booking.hour.split(':').map(Number);
      const delayMin = nowMin - (h * 60 + m);

      if (delayMin >= 5 && delayMin <= 120) {
        this.notifiedBookingIds.add(booking.id);
        newlyLate.push(`${booking.court.name} (${booking.hour}hs)`);

        this.notificationService.add({
          id: `delay-${booking.id}`,
          title: 'Turno con retraso',
          message: `${booking.clientName} — ${booking.court.name} ${booking.hour}hs sin iniciar`,
          category: 'TURNOS',
          actionRoute: ['/app/schedule'],
          queryParams: { date: todayStr, openBooking: booking.id },
          entityId: booking.id,
          createdAt: new Date(),
        });
      }
    });

    if (newlyLate.length === 0) return;

    const count = newlyLate.length;
    const detail =
      count === 1 ? newlyLate[0] : `${count} turnos: ${newlyLate.join(', ')}`;

    this.toast.info(
      `🔔 ${count === 1 ? 'Turno atrasado' : `${count} turnos atrasados`}`,
      `Sin iniciar — ${detail}`,
    );
  }

  /** `true` si el usuario actual es administrador. */
  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  /**
   * Genera el valor de `grid-template-columns` para la grilla de turnos.
   * La primera columna (horas) tiene ancho fijo de 80 px; las canchas usan minmax(200px, 1fr).
   */
  get gridColsStyle(): string {
    return `80px repeat(${this.courts.length}, minmax(200px, 1fr))`;
  }

  /** Solo las columnas de canchas (sin la columna de horas), para el panel derecho scrollable. */
  get courtColsStyle(): string {
    return `repeat(${this.courts.length}, minmax(200px, 1fr))`;
  }

  /** Convierte una hora 'HH:mm' a minutos totales desde medianoche. */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Franja horaria activa que coincide con la fecha, hora y duración seleccionadas.
   * Devuelve `null` si no hay franja configurada (fallback a precios de cancha).
   */
  get activeShift(): PricingShift | null {
    if (!this.selectedSlot || !this.pricingShifts.length) return null;
    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const realDay = new Date(year, month - 1, day).getDay();
    const dayOfWeek = this.holidayService.isHoliday ? 6 : realDay;
    const bookingMin = this.timeToMinutes(this.selectedSlot.hour);
    return (
      this.pricingShifts.find((s) => {
        const days = (s.daysOfWeek as number[]).map(Number);
        if (!days.includes(dayOfWeek)) return false;
        const startMin = this.timeToMinutes(s.startTime);
        const endMin = this.timeToMinutes(s.endTime);
        return startMin <= endMin
          ? bookingMin >= startMin && bookingMin < endMin
          : bookingMin >= startMin || bookingMin < endMin;
      }) ?? null
    );
  }

  /**
   * Devuelve la etiqueta legible del tipo de tarifa aplicada a una reserva existente.
   * Prioridad: Profesor > Turno Fijo > Franja Horaria coincidente > Estándar.
   */
  getPriceLabel(booking: BookingResponse): string {
    if (booking.priceType === 'professor') return 'Profesor';
    if (booking.appliedShiftName) return booking.appliedShiftName;
    if (this.pricingShifts.length) {
      const [year, month, day] = booking.date.split('-').map(Number);
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const bookingMin = this.timeToMinutes(booking.hour);
      const shift = this.pricingShifts.find((s) => {
        const days = (s.daysOfWeek as number[]).map(Number);
        if (!days.includes(dayOfWeek)) return false;
        const startMin = this.timeToMinutes(s.startTime);
        const endMin = this.timeToMinutes(s.endTime);
        return startMin <= endMin
          ? bookingMin >= startMin && bookingMin < endMin
          : bookingMin >= startMin || bookingMin < endMin;
      });
      if (shift) return shift.name;
    }
    return 'Estándar';
  }

  /**
   * True cuando hay un slot seleccionado pero ninguna franja cubre ese día/hora.
   * Indica que no hay precio válido configurado y el guardado debe bloquearse.
   */
  get isTariffMissing(): boolean {
    return !!this.selectedSlot && this.activeShift === null;
  }

  /**
   * Cierra el modal y navega a la pantalla de configuración de tarifas.
   * Permite al operador resolver la ausencia de franja sin perder contexto.
   */
  goToTariffsConfig(): void {
    this.closeDialog();
    this.router.navigate(['/app/pricing-shifts']);
  }

  /** Precio de la cancha según franja dinámica activa, con fallback a precios estáticos. */
  get courtPrice(): number {
    if (!this.selectedSlot) return 0;
    const shift = this.activeShift;
    if (shift) {
      if (this.isTeacherBooking) {
        return Number(shift.teacherPricePerHour) * (this.durationMinutes / 60);
      }
      switch (this.durationMinutes) {
        case 30:
          return Number(shift.price30min) || 0;
        case 90:
          return Number(shift.price90min) || 0;
        case 120:
          return Number(shift.price120min) || 0;
        default:
          return Number(shift.price60min) || 0;
      }
    }
    return 0;
  }

  /** Hora de fin calculada a partir del slot seleccionado y la duración. */
  get endHour(): string {
    if (!this.selectedSlot) return '';
    const [h, m] = this.selectedSlot.hour.split(':').map(Number);
    const totalMin = h * 60 + m + this.durationMinutes;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  /** Subtotal de los ítems del carrito de creación. */
  get cartSubtotal(): number {
    return this.cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }

  /** Total de la reserva: precio cancha + subtotal de ítems. */
  get totalReserva(): number {
    return this.courtPrice + this.cartSubtotal;
  }

  /** Suma de efectivo y transferencia ingresados en el formulario de creación. */
  get totalPagado(): number {
    return (
      (Number(this.pagoEfectivo) || 0) + (Number(this.pagoTransferencia) || 0)
    );
  }

  /** Diferencia entre el total y lo pagado (puede ser negativo = vuelto). */
  get saldoPendiente(): number {
    return this.totalReserva - this.totalPagado;
  }

  /** Clases CSS del badge de balance según el estado del pago. */
  get balanceClass(): string {
    if (this.saldoPendiente === 0) return 'bg-accent text-accent-foreground';
    if (this.saldoPendiente > 0) return 'bg-destructive/10 text-destructive';
    return 'bg-yellow-500/10 text-yellow-700';
  }

  /** Texto descriptivo del balance: pago completo, falta pagar o vuelto. */
  get balanceText(): string {
    const fmt = (n: number) => n.toLocaleString('es-AR');
    if (this.saldoPendiente === 0) return '✓ Pago Completo';
    if (this.saldoPendiente > 0)
      return `Falta Pagar: $${fmt(this.saldoPendiente)}`;
    return `Vuelto: $${fmt(Math.abs(this.saldoPendiente))}`;
  }

  /** Carga canchas, productos y config en paralelo, luego dispara la carga de reservas del día. */
  private loadInitialData(): void {
    this.isLoading = true;
    this.loadError = '';

    this.sub.add(
      forkJoin({
        courts: this.courtsService.findAll(),
        products: this.productsService.findAll(),
        config: this.configService.getAll().pipe(catchError(() => of([]))),
        teachers: this.teachersService.findAll().pipe(catchError(() => of([]))),
        pricingShifts: this.pricingShiftsService
          .getActive()
          .pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ courts, products, config, teachers, pricingShifts }) => {
          const cfgMap = new Map(config.map((e) => [e.key, e.value]));
          if (cfgMap.has('hora_apertura'))
            this.horarioApertura = cfgMap.get('hora_apertura')!;
          if (cfgMap.has('hora_cierre'))
            this.horarioCierre = cfgMap.get('hora_cierre')!;
          this.HOURS = this.buildHoursFromRange(
            this.horarioApertura,
            this.horarioCierre,
          );

          this.courts = courts.filter((c) => c.isActive);
          this.allProducts = products.filter((p) => p.isActive);
          this.teachers = teachers.filter((t: Teacher) => t.isActive);
          this.pricingShifts = pricingShifts as PricingShift[];
          this.loadBookings();
        },
        error: () => {
          this.isLoading = false;
          this.loadError =
            'No se pudo conectar con el servidor. ' +
            'Verificá que el backend esté corriendo en localhost:3000.';
        },
      }),
    );
  }

  /** Recarga las reservas del día seleccionado y actualiza el bookingMap. */
  loadBookings(onLoaded?: () => void): void {
    this.isLoading = true;
    this.sub.add(
      this.bookingsService.findByDate(this.selectedDate).subscribe({
        next: (bookings) => {
          this.bookingMap.clear();
          bookings.forEach((b) => {
            if (b.status !== 'cancelled') {
              this.addToBookingMap(b);
            }
          });
          this.isLoading = false;
          this.scrollToCurrentTime();
          onLoaded?.();
        },
        error: () => {
          this.isLoading = false;
          this.toast.error(
            'Error',
            'No se pudieron cargar las reservas del día.',
          );
        },
      }),
    );
  }

  /** Dispara la recarga de reservas al cambiar la fecha seleccionada. */
  onDateChange(): void {
    this.loadBookings();
  }

  /**
   * Hace scroll suave hasta la fila de la hora actual cuando la fecha
   * seleccionada corresponde a la jornada activa.
   * Incluye un setTimeout interno de 150ms para garantizar que Angular
   * haya terminado el ciclo de render del *ngFor antes de buscar el elemento.
   */
  scrollToCurrentTime(): void {
    const now = new Date();
    const businessDay = new Date(now);
    if (now.getHours() < 2) {
      businessDay.setDate(businessDay.getDate() - 1);
    }

    const y = businessDay.getFullYear();
    const m = String(businessDay.getMonth() + 1).padStart(2, '0');
    const d = String(businessDay.getDate()).padStart(2, '0');
    const businessDayStr = `${y}-${m}-${d}`;

    if (this.selectedDate !== businessDayStr) {
      return;
    }

    const h = now.getHours();
    const min = now.getMinutes();
    const slot = min < 30 ? '00' : '30';
    const targetId = `time-row-${h.toString().padStart(2, '0')}:${slot}`;
    const fallbackId = `time-row-${this.horarioApertura}`;

    setTimeout(() => {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const fallbackElement = document.getElementById(fallbackId);
        if (fallbackElement) {
          fallbackElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    }, 150);
  }

  /** Navega al día anterior y recarga las reservas. */
  prevDay(): void {
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d - 1);
    this.selectedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    this.loadBookings();
  }

  /** Navega al día siguiente y recarga las reservas. */
  nextDay(): void {
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d + 1);
    this.selectedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    this.loadBookings();
  }

  /** Devuelve la reserva mapeada para una cancha y hora específica. */
  getBooking(courtId: string, hour: string): BookingResponse | undefined {
    return this.bookingMap.get(`${courtId}-${hour}`);
  }

  /** True si este slot es la hora de inicio de una reserva. */
  isStartSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    return b != null && b.hour === hour;
  }

  /** True si este slot es una continuación de una reserva que inició antes. */
  isContinuationSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    return b != null && b.hour !== hour;
  }

  /** True si este slot es la última fila de continuación de una reserva (en slots de 30 min). */
  isLastContinuationSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    if (!b || b.hour === hour) return false;
    const [bh, bm] = b.hour.split(':').map(Number);
    const endMin = bh * 60 + bm + (b.durationMinutes ?? 60);
    const lastSlotMin = endMin - 30;
    const lH = Math.floor(lastSlotMin / 60);
    const lM = lastSlotMin % 60;
    const lastSlot = `${lH.toString().padStart(2, '0')}:${lM.toString().padStart(2, '0')}`;
    return hour === lastSlot;
  }

  /**
   * Devuelve clases Tailwind de borde y redondeo para conectar visualmente los slots
   * de una reserva multi-slot en un bloque continuo (slots de 30 min).
   */
  getSlotConnectClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b) return 'rounded-lg border-2';
    const slots = (b.durationMinutes ?? 60) / 30;
    if (slots <= 1) return 'rounded-lg border-2';
    if (b.hour === hour)
      return 'rounded-t-lg rounded-b-none border-t-2 border-l-2 border-r-2';
    if (this.isLastContinuationSlot(courtId, hour))
      return 'rounded-t-none rounded-b-lg border-b-2 border-l-2 border-r-2';
    return 'rounded-none border-l-2 border-r-2';
  }

  /**
   * Altura en rem de la tarjeta de reserva.
   *
   * FÓRMULA: `numSlots * SLOT_H_REM + (numSlots - 1) * SLOT_GAP_REM`
   * donde SLOT_H_REM (3rem) coincide con h-12 y SLOT_GAP_REM (0.5rem) con space-y-2.
   * Al usar rem la altura escala junto con el font-size global sin desincronizarse.
   * Ejemplo: 60 min = 2 slots → 2*3 + 1*0.5 = 6.5rem.
   */
  private readonly SLOT_H_REM = 3;
  private readonly SLOT_GAP_REM = 0.5;

  /** Altura rem del bloque exterior de la tarjeta de reserva según su duración. */
  getBookingBlockHeight(booking: BookingResponse): string {
    const numSlots = (booking.durationMinutes ?? 60) / 30;
    const total =
      numSlots * this.SLOT_H_REM + (numSlots - 1) * this.SLOT_GAP_REM;
    return `${total}rem`;
  }

  /** Altura rem del bloque interior de la tarjeta (2px menos por cada lado de inset). */
  getBookingBlockHeightInner(booking: BookingResponse): string {
    const numSlots = (booking.durationMinutes ?? 60) / 30;
    const total =
      numSlots * this.SLOT_H_REM + (numSlots - 1) * this.SLOT_GAP_REM;
    return `calc(${total}rem - 4px)`;
  }

  /** Devuelve las clases CSS del slot según su estado (disponible, reservado, jugando, completado). */
  getSlotClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b)
      return 'border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/5';
    if (b.status === 'booked')
      return 'border-primary bg-primary/10 text-primary dark:bg-primary/20';
    if (b.status === 'playing')
      return 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (b.status === 'completed')
      return 'border-slate-400 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400';
    return 'border-dashed border-muted-foreground/30';
  }

  /** Subtotal de los ítems del carrito en el modo detalle. */
  get detailItemsSubtotal(): number {
    return this.detailCart.reduce(
      (sum, i) => sum + Number(i.unitPrice) * Number(i.quantity),
      0,
    );
  }

  /** Total cancha + consumos en el modo detalle. Usa Number() para evitar concatenación con strings de PostgreSQL. */
  get detailTotalReserva(): number {
    return (
      Number(this.selectedBooking?.priceAmount ?? 0) + this.detailItemsSubtotal
    );
  }

  /** Suma de los montos de pago ingresados en el modo detalle. */
  get detailTotalPagado(): number {
    return this.totalPagadoEfectivo + this.totalPagadoTransferencia;
  }

  /**
   * Saldo pendiente según el modo de división activo.
   * Se usa para la lógica de división entre jugadores y botones de pago parcial.
   */
  get detailSaldoPendiente(): number {
    return Math.max(0, this.splitBase - this.detailTotalPagado);
  }

  /**
   * Saldo pendiente REAL: cancha + TODOS los consumos - total pagado.
   * Se usa para bloquear "Finalizar" y para el resumen general.
   */
  get detailSaldoPendienteReal(): number {
    return Math.max(0, this.detailTotalReserva - this.detailTotalPagado);
  }

  /** Clases CSS del badge de balance en el modo detalle. */
  get detailBalanceClass(): string {
    if (this.detailSaldoPendiente <= 0)
      return 'bg-green-50 text-green-800 border border-green-200';
    return 'bg-destructive/10 text-destructive';
  }

  /** Efectivo total: lo ya guardado en DB + lo ingresado en esta sesión. */
  get totalPagadoEfectivo(): number {
    return this.savedAmountCash + (Number(this.detailAmountCash) || 0);
  }

  /** Transferencia total: lo ya guardado en DB + lo ingresado en esta sesión. */
  get totalPagadoTransferencia(): number {
    return this.savedAmountTransfer + (Number(this.detailAmountTransfer) || 0);
  }

  /**
   * Vuelto a entregar: diferencia positiva entre lo ingresado y la base del modo activo.
   * Solo tiene valor cuando el cliente entregó más dinero del necesario.
   */
  get vuelto(): number {
    return Math.max(0, this.detailTotalPagado - this.splitBase);
  }

  /** Texto del badge de balance en el modo detalle. */
  get detailBalanceText(): string {
    if (this.detailSaldoPendiente <= 0) return '✓ Pago Completo';
    return `Falta Pagar: $${this.fmt(this.detailSaldoPendiente)}`;
  }

  /** Subtotal de consumos pendientes de pago (ítems no marcados como pagados). */
  get detailUnpaidItemsSubtotal(): number {
    return this.detailCart
      .filter((i) => !i.isPaid)
      .reduce((s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0);
  }

  /** true cuando hay al menos un consumo sin pagar — habilita el modo 'court+items'. */
  get hasUnpaidItems(): boolean {
    return this.detailUnpaidItemsSubtotal > 0;
  }

  /**
   * true cuando hay consumos sin pagar O consumos comprometidos localmente
   * en el modo "Dividir por Jugador" (pendientes de guardar).
   * Se usa para mostrar el panel de consumos en la vista derecha.
   */
  get hasUnpaidOrCommittedItems(): boolean {
    return (
      this.hasUnpaidItems || this.detailCart.some((i) => i.committedBySplit)
    );
  }

  /**
   * Base de cálculo para la división entre jugadores según el modo elegido:
   * - 'court': solo el precio de cancha.
   * - 'court+items': precio de cancha + consumos pendientes de cobro.
   * Si no hay consumos pendientes, siempre usa solo cancha independientemente del modo.
   */
  /** División de cuenta habilitada solo cuando el partido está en curso o finalizado. */
  get canSplitAccount(): boolean {
    const status = this.selectedBooking?.status;
    return status === 'playing' || status === 'completed';
  }

  /** Monto base para el split de pago: solo cancha o cancha + ítems no pagados según el modo activo. */
  private get splitBase(): number {
    const courtPrice = Number(this.selectedBooking?.priceAmount ?? 0);
    return this.splitMode === 'court' || !this.hasUnpaidItems
      ? courtPrice
      : courtPrice + this.detailUnpaidItemsSubtotal;
  }

  /** Monto dividido en partes iguales según el modo de división activo. */
  get detailCostPerPlayer(): number {
    const n = this.detailPlayerCount || 1;
    return Math.ceil(this.splitBase / n);
  }

  /** Deuda restante (según el modo activo) dividida entre los jugadores que aún no pagaron. */
  get detailDebtPerPlayer(): number {
    const remaining = Math.max(
      1,
      this.detailPlayerCount - this.detailPaidCount,
    );
    return Math.ceil(this.detailSaldoPendiente / remaining);
  }

  /**
   * Cuota FIJA de cancha por jugador. Inmutable: no varía por pagos parciales
   * previos ni por consumos adicionales de otros jugadores.
   * Es la única base válida para cobrar la parte proporcional de cancha.
   */
  get baseCanchaSplit(): number {
    const courtPrice = Number(this.selectedBooking?.priceAmount ?? 0);
    const n = this.detailPlayerCount || 1;
    return Math.ceil(courtPrice / n);
  }

  /** `true` si ya existe un pago parcial previo registrado en la base de datos. */
  get hasPriorPayment(): boolean {
    return this.savedAmountCash + this.savedAmountTransfer > 0;
  }

  /**
   * Monto que se suma al input de pago cuando un jugador paga.
   * Siempre es la cuota fija de cancha — no se recalcula sobre el saldo restante
   * para evitar que los consumos pagados por otros jugadores bajen la cuota.
   */
  get perPlayerAmount(): number {
    return this.baseCanchaSplit;
  }

  /**
   * Marca los consumos seleccionados como asignados al pago del jugador actual.
   * Los oculta del panel derecho (isPaid: true) pero NO los muestra como "✓ Pagado"
   * en el panel izquierdo hasta que se confirme con "Registrar Pago" (committedBySplit: true).
   * Retorna los índices comprometidos para poder deshacer la operación.
   */
  private commitSelectedConsumables(): number[] {
    if (this.selectedConsumableKeys.size === 0) return [];

    // Calcular cuántas unidades de cada cartIdx están seleccionadas usando flatUnpaidConsumables
    const selectedCountByIdx = new Map<number, number>();
    for (const unit of this.flatUnpaidConsumables) {
      if (!unit.committed && this.selectedConsumableKeys.has(unit.key)) {
        selectedCountByIdx.set(
          unit.cartIdx,
          (selectedCountByIdx.get(unit.cartIdx) ?? 0) + 1,
        );
      }
    }

    // Construir nuevo carrito partiendo ítems cuando solo se seleccionan algunas unidades
    const newCart: CartItem[] = [];
    const committedNewIndices: number[] = [];

    for (let i = 0; i < this.detailCart.length; i++) {
      const item = this.detailCart[i];
      const units = selectedCountByIdx.get(i) ?? 0;

      if (!item.isPaid && units > 0) {
        if (units >= item.quantity) {
          // Todas las unidades → commit ítem completo
          committedNewIndices.push(newCart.length);
          newCart.push({
            ...item,
            isPaid: true,
            committedBySplit: true,
            selectedForPayment: false,
          });
        } else {
          // Solo algunas unidades → separar en dos ítems
          // Primero el committed (las unidades seleccionadas)
          committedNewIndices.push(newCart.length);
          newCart.push({
            ...item,
            quantity: units,
            isPaid: true,
            committedBySplit: true,
            selectedForPayment: false,
          });
          // Luego el restante (sin pagar)
          newCart.push({
            ...item,
            quantity: item.quantity - units,
            selectedForPayment: false,
          });
        }
      } else {
        newCart.push(item);
      }
    }

    this.detailCart = newCart;
    this.selectedConsumableKeys = new Set();
    return committedNewIndices;
  }

  /** Registra el pago en efectivo de un jugador e incrementa el contador de pagados. */
  addPaidByCash(): void {
    if (
      this.detailPaidCount >= this.detailPlayerCount ||
      this.detailSaldoPendiente <= 0
    )
      return;
    const cartSnapshot = this.detailCart.map((i) => ({ ...i }));
    const amount = this.currentPlayerTotal;
    this.detailAmountCash = (Number(this.detailAmountCash) || 0) + amount;
    const committedIndices = this.commitSelectedConsumables();
    this.playerPaymentHistory.push({
      method: 'cash',
      amount,
      committedIndices,
      cartSnapshot,
    });
    this.partialCashCount++;
    this.detailPaidCount++;
  }

  /** Registra el pago por transferencia de un jugador e incrementa el contador de pagados. */
  addPaidByTransfer(): void {
    if (
      this.detailPaidCount >= this.detailPlayerCount ||
      this.detailSaldoPendiente <= 0
    )
      return;
    const cartSnapshot = this.detailCart.map((i) => ({ ...i }));
    const amount = this.currentPlayerTotal;
    this.detailAmountTransfer =
      (Number(this.detailAmountTransfer) || 0) + amount;
    const committedIndices = this.commitSelectedConsumables();
    this.playerPaymentHistory.push({
      method: 'transfer',
      amount,
      committedIndices,
      cartSnapshot,
    });
    this.partialTransferCount++;
    this.detailPaidCount++;
  }

  /**
   * Deshace el último pago del método indicado buscando en el historial LIFO.
   * Revierte el monto y decrementa los contadores correspondientes.
   */
  undoPartialPayment(method: 'cash' | 'transfer'): void {
    if (this.detailPaidCount <= 0) return;
    const idx = [...this.playerPaymentHistory]
      .reverse()
      .findIndex((e) => e.method === method);
    if (idx === -1) return;
    const realIdx = this.playerPaymentHistory.length - 1 - idx;
    const entry = this.playerPaymentHistory.splice(realIdx, 1)[0];
    if (method === 'cash') {
      this.detailAmountCash = Math.max(
        0,
        (Number(this.detailAmountCash) || 0) - entry.amount,
      );
      this.partialCashCount = Math.max(0, this.partialCashCount - 1);
    } else {
      this.detailAmountTransfer = Math.max(
        0,
        (Number(this.detailAmountTransfer) || 0) - entry.amount,
      );
      this.partialTransferCount = Math.max(0, this.partialTransferCount - 1);
    }
    this.detailPaidCount--;
    // Restaurar el carrito al estado previo al pago usando el snapshot
    this.detailCart = entry.cartSnapshot.map((i) => ({ ...i }));
    this.selectedConsumableKeys = new Set();
  }

  /** Completa el saldo pendiente con efectivo y marca todos los jugadores como pagados. */
  settleInCash(): void {
    if (this.detailSaldoPendiente <= 0) return;
    this.detailAmountCash =
      (Number(this.detailAmountCash) || 0) + this.detailSaldoPendiente;
    this.detailPaidCount = this.detailPlayerCount;
  }

  /** Completa el saldo pendiente con transferencia y marca todos los jugadores como pagados. */
  settleInTransfer(): void {
    if (this.detailSaldoPendiente <= 0) return;
    this.detailAmountTransfer =
      (Number(this.detailAmountTransfer) || 0) + this.detailSaldoPendiente;
    this.detailPaidCount = this.detailPlayerCount;
  }

  /** Emite al Subject de auto-save del formulario de creación. */
  triggerBookingDraftSave(): void {
    this.bookingDraftSave$.next();
  }

  /** Cambia la duración del turno y fuerza un guardado del borrador. */
  setDuration(minutes: number): void {
    this.durationMinutes = minutes;
    this.triggerBookingDraftSave();
  }

  /**
   * Restaura el borrador del formulario de creación.
   * Llamado cuando el usuario hace clic en "Recuperar" en el banner.
   */
  applyBookingDraft(): void {
    const d = this.draftService.getDraft<{
      clientName: string;
      phoneNumber: string;
      priceType: 'standard' | 'professor';
      durationMinutes: number;
      pagoEfectivo: number;
      pagoTransferencia: number;
    }>(this.DRAFT_KEY_BOOKING);
    if (d) {
      this.clientName = d.clientName ?? '';
      this.phoneNumber = d.phoneNumber ?? '';
      this.priceType = d.priceType ?? 'standard';
      this.durationMinutes = d.durationMinutes ?? 60;
      this.pagoEfectivo = d.pagoEfectivo ?? 0;
      this.pagoTransferencia = d.pagoTransferencia ?? 0;
    }
    this.showBookingDraftBanner = false;
  }

  /** Descarta el borrador del formulario de creación sin restaurarlo. */
  dismissBookingDraft(): void {
    this.draftService.clearDraft(this.DRAFT_KEY_BOOKING);
    this.showBookingDraftBanner = false;
  }

  /** Limpia los inputs de efectivo y transferencia de la sesión actual. */
  clearPaymentInputs(): void {
    this.detailAmountCash = 0;
    this.detailAmountTransfer = 0;
    this.detailPaidCount = this.initialPaidCount;
    this.playerPaymentHistory = [];
    this.partialCashCount = 0;
    this.partialTransferCount = 0;
  }

  /** Hora de fin calculada a partir de la reserva actualmente mostrada en el detalle. */
  get detailEndHour(): string {
    if (!this.selectedBooking) return '';
    const [h, m] = this.selectedBooking.hour.split(':').map(Number);
    const totalMin = h * 60 + m + (this.selectedBooking.durationMinutes ?? 60);
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  /** Suma los montos de un pago (el backend devuelve strings numéricos desde PostgreSQL). */
  getPaymentTotal(payment: BookingPayment): number {
    return Number(payment.amountCash) + Number(payment.amountTransfer);
  }

  /** Devuelve el label en español del estado de una reserva. */
  getStatusLabel(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      booked: 'Reservado',
      playing: 'Jugando',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return map[status] ?? status;
  }

  /** Devuelve las clases CSS del badge de estado de una reserva. */
  getStatusBadgeClass(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      booked: 'bg-primary/15 text-primary dark:bg-primary/25',
      playing:
        'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      completed:
        'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
      cancelled: 'bg-destructive/15 text-destructive',
    };
    return map[status] ?? 'bg-muted text-muted-foreground';
  }

  /**
   * Maneja el click sobre un slot de la grilla.
   * Si hay una reserva iniciando en ese slot, abre el detalle; si está libre, abre el formulario de creación.
   * Los slots de continuación (donde la reserva inició antes) son ignorados.
   */
  onSlotClick(court: Court, hour: string): void {
    if (this.isDragging || this.rescheduleDialogOpen) return;

    const booking = this.getBooking(court.id, hour);
    if (booking && booking.hour === hour) {
      this.openDetailDialog(court, hour, booking);
    } else if (!booking) {
      this.openCreateDialog(court, hour);
    }
  }

  /** Abre el diálogo en modo creación para el slot indicado. */
  private openCreateDialog(court: Court, hour: string): void {
    this.dialogMode = 'create';
    this.selectedSlot = { court, hour };
    this.selectedBooking = null;
    this.resetForm();
    this.isDialogOpen = true;
    this.showBookingDraftBanner = this.draftService.hasDraft(
      this.DRAFT_KEY_BOOKING,
    );
  }

  /** Abre el diálogo en modo detalle pre-cargando los datos de la reserva. */
  private openDetailDialog(
    court: Court,
    hour: string,
    booking: BookingResponse,
  ): void {
    this.dialogMode = 'detail';
    this.selectedSlot = { court, hour };
    this.selectedBooking = booking;
    this.initDetailState(booking);
    this.isDialogOpen = true;
  }

  /**
   * Inicializa el estado del modo detalle a partir de los datos de la reserva.
   * Si ya existe un pago previo, infiere cuántos jugadores pagaron para
   * restaurar el estado visual y evitar el bug de "jugadores pagados perdidos".
   */
  private initDetailState(booking: BookingResponse): void {
    const savedTotal =
      Number(booking.payment?.amountCash ?? 0) +
      Number(booking.payment?.amountTransfer ?? 0);

    this.detailCart = booking.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      isPaid: item.isPaid ?? false,
      selectedForPayment: false,
    }));

    this.savedAmountCash = Number(booking.payment?.amountCash ?? 0);
    this.savedAmountTransfer = Number(booking.payment?.amountTransfer ?? 0);
    this.detailAmountCash = 0;
    this.detailAmountTransfer = 0;
    this.detailPlayerCount = booking.playerCount ?? 4;
    this.detailPaymentTab = 'quick';

    if (savedTotal > 0) {
      const itemsSubtotal = this.detailCart.reduce(
        (s, i) => s + i.unitPrice * i.quantity,
        0,
      );
      const totalBooking = Number(booking.priceAmount ?? 0) + itemsSubtotal;
      const costPerPlayer =
        this.detailPlayerCount > 0 ? totalBooking / this.detailPlayerCount : 1;
      this.detailPaidCount =
        costPerPlayer > 0
          ? Math.min(
              Math.round(savedTotal / costPerPlayer),
              this.detailPlayerCount,
            )
          : 0;
    } else {
      this.detailPaidCount = 0;
    }

    this.playerPaymentHistory = [];
    this.partialCashCount = 0;
    this.partialTransferCount = 0;
    this.splitMode = 'court+items';
    this.initialPaidCount = this.detailPaidCount;
    this.detailProductSearch = '';
    this.detailSearchResults = [];
  }

  /** `true` si hay montos de pago ingresados en esta sesión que aún no se guardaron. */
  get hasUnsavedPaymentChanges(): boolean {
    return (
      (Number(this.detailAmountCash) || 0) !== 0 ||
      (Number(this.detailAmountTransfer) || 0) !== 0
    );
  }

  /**
   * Cierra el diálogo. Si hay pagos sin guardar o jugadores marcados como pagados,
   * muestra un diálogo de confirmación antes de cerrar.
   */
  /**
   * Abre WhatsApp con un mensaje de confirmación de asistencia para el turno fijo.
   * Requiere que el `FixedBooking` tenga un número de teléfono registrado.
   */
  confirmFixedBookingWhatsApp(): void {
    const booking = this.selectedBooking;
    if (!booking) return;

    const phone = booking.fixedBooking?.phoneNumber?.replace(/\D/g, '');
    if (!phone) {
      this.toast.info(
        'Sin número registrado',
        'Este turno fijo no tiene un teléfono registrado.',
      );
      return;
    }

    const courtName = booking.court?.name ?? 'la cancha';
    const message = `Hola *${booking.clientName}*, te escribimos desde la Caldera Padel para confirmar tu turno fijo de hoy a las *${booking.hour}*hs en la *${courtName}*. ¿Nos confirmás tu asistencia?`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
    );
  }

  /**
   * Marca el turno fijo como confirmado (isConfirmed = true).
   * Limpia la notificación de recordatorio y el flag de WA del localStorage.
   */
  confirmBooking(): void {
    const booking = this.selectedBooking;
    if (!booking || this.isConfirmingBooking) return;

    this.isConfirmingBooking = true;
    this.bookingsService.confirm(booking.id).subscribe({
      next: (updated) => {
        this.isConfirmingBooking = false;
        this.selectedBooking = { ...booking, isConfirmed: true };
        this.addToBookingMap({ ...booking, isConfirmed: true });
        this.notificationService.removeByEntityId(booking.id);
        localStorage.removeItem(`wa_clicked_reminder-today-${booking.id}`);
        localStorage.removeItem(`wa_clicked_reminder-tomorrow-${booking.id}`);
        this.toast.success(
          'Asistencia confirmada',
          `${booking.clientName} confirmó su turno.`,
        );
      },
      error: () => {
        this.isConfirmingBooking = false;
        this.toast.error('Error', 'No se pudo confirmar la asistencia.');
      },
    });
  }

  /**
   * Confirma la seña recurrente esperada del turno fijo con 1 clic.
   * Llama a POST /bookings/:id/confirm-expected-deposit.
   * No requiere caja abierta (es transferencia).
   * Actualiza el booking en el mapa para que el botón desaparezca inmediatamente.
   */
  isConfirmingDeposit = false;

  confirmExpectedDeposit(): void {
    const booking = this.selectedBooking;
    if (!booking || this.isConfirmingDeposit) return;

    this.isConfirmingDeposit = true;
    this.bookingsService.confirmExpectedDeposit(booking.id).subscribe({
      next: (updated) => {
        this.isConfirmingDeposit = false;
        this.selectedBooking = updated;
        this.addToBookingMap(updated);
        this.toast.success(
          'Seña confirmada',
          `$${booking.expectedDepositAmount?.toLocaleString('es-AR')} registrado por transferencia.`,
        );
      },
      error: (err) => {
        this.isConfirmingDeposit = false;
        const msg = err?.error?.message ?? 'No se pudo confirmar la seña.';
        this.toast.error('Error', Array.isArray(msg) ? msg.join(' ') : msg);
      },
    });
  }

  /** Cierra el diálogo de detalle o creación, solicitando confirmación si hay cambios sin guardar. */
  closeDialog(): void {
    if (this.confirmDialogOpen) return;

    if (this.dialogMode === 'detail') {
      const hasPaid = this.detailPaidCount > this.initialPaidCount;
      const hasPayment = this.hasUnsavedPaymentChanges;

      if (hasPaid || hasPayment) {
        const newPaid = this.detailPaidCount - this.initialPaidCount;
        const paidMsg = hasPaid
          ? `${newPaid} jugador${newPaid > 1 ? 'es' : ''} marcado${newPaid > 1 ? 's' : ''} como pagado${newPaid > 1 ? 's' : ''}`
          : '';
        const paymentMsg = hasPayment ? 'montos de pago sin guardar' : '';
        this.confirmDialogTitle = 'Pago sin registrar';
        this.confirmDialogMessage = `Hay ${[paidMsg, paymentMsg].filter(Boolean).join(' y ')}. ¿Cerrar sin registrar el pago?`;
        this.confirmCallback = () => this.forceCloseDialog();
        this.confirmDialogOpen = true;
        return;
      }
    }
    this.forceCloseDialog();
  }

  /** Acepta el diálogo de confirmación y ejecuta el callback registrado. */
  confirmDialogAccept(): void {
    this.confirmDialogOpen = false;
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
  }

  /** Cancela el diálogo de confirmación sin ejecutar ninguna acción. */
  confirmDialogCancel(): void {
    this.confirmDialogOpen = false;
    this.confirmCallback = null;
  }

  /** Cierra el diálogo sin validaciones, limpiando todo el estado temporal. */
  private forceCloseDialog(): void {
    this.isDialogOpen = false;
    this.productSearch = '';
    this.searchResults = [];
    this.detailCart = [];
    this.detailProductSearch = '';
    this.detailSearchResults = [];
    this.detailPaidCount = 0;
    this.initialPaidCount = 0;
    this.savedAmountCash = 0;
    this.savedAmountTransfer = 0;
    this.playerPaymentHistory = [];
    this.partialCashCount = 0;
    this.partialTransferCount = 0;
    this.selectedConsumableKeys = new Set();
    this.splitMode = 'court+items';
  }

  /** Resetea el formulario de creación a sus valores iniciales. */
  private resetForm(): void {
    this.clientName = '';
    this.phoneNumber = '';
    this.priceType = 'standard';
    this.durationMinutes = 60;
    this.cart = [];
    this.pagoEfectivo = 0;
    this.pagoTransferencia = 0;
    this.productSearch = '';
    this.searchResults = [];
    this.isFixedBookingMode = false;
    this.isTeacherBooking = false;
    this.selectedTeacherId = null;
  }

  /**
   * Maneja el cambio del toggle "¿Es turno de Profesor?".
   * Al activarlo fuerza la duración a 60 min (único bloque válido para profesores).
   * Al desactivarlo limpia el profesor seleccionado.
   */
  onTeacherToggleChange(): void {
    if (this.isTeacherBooking) {
      this.durationMinutes = 60;
    } else {
      this.selectedTeacherId = null;
      if (this.clientName.startsWith('Clase - ')) {
        this.clientName = '';
      }
    }
  }

  /** Al seleccionar un profesor, autocompleta el nombre del cliente para evitar entrada manual. */
  onTeacherSelectChange(teacherId: string | null): void {
    const teacher = this.teachers.find((t) => t.id === teacherId);
    this.clientName = teacher ? `Clase - ${teacher.fullName}` : '';
  }

  /** Valida el formulario y envía la petición de creación al servidor. */
  saveBooking(): void {
    if (!this.selectedSlot || this.isSaving) return;

    if (!this.clientName.trim()) {
      this.toast.error(
        'Campo requerido',
        'Por favor ingresá el nombre del cliente.',
      );
      return;
    }

    if (this.isFixedBookingMode && !this.phoneNumber.trim()) {
      this.toast.error(
        'Teléfono requerido',
        'El número de WhatsApp es obligatorio para turnos fijos.',
      );
      return;
    }

    if (!this.isCashRegisterOpen && Number(this.pagoEfectivo) > 0) {
      Swal.fire({
        title: '¡Caja Cerrada!',
        text: 'Necesitas abrir un turno en la caja para poder registrar cobros en efectivo.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ir a Abrir Caja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5',
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/app/cash-register']);
        }
      });
      return;
    }

    this.isSaving = true;

    if (this.isFixedBookingMode) {
      const [y, mo, dy] = this.selectedDate.split('-').map(Number);
      const jsDay = new Date(y, mo - 1, dy).getDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      this.sub.add(
        this.fixedBookingsService
          .create({
            clientName: this.clientName.trim(),
            phoneNumber: this.phoneNumber.trim(),
            dayOfWeek,
            hour: this.selectedSlot.hour,
            durationMinutes: this.durationMinutes,
            courtId: this.selectedSlot.court.id,
            startDate: this.selectedDate,
            teacherId: this.isTeacherBooking
              ? this.selectedTeacherId || null
              : null,
          })
          .subscribe({
            next: () => {
              this.isSaving = false;
              this.draftService.clearDraft(this.DRAFT_KEY_BOOKING);
              this.showBookingDraftBanner = false;
              this.toast.success(
                '⭐ Turno Fijo creado',
                `${this.clientName.trim()} — ${this.selectedSlot!.court.name} los ${this.selectedDate} a las ${this.selectedSlot!.hour}hs y todas las semanas.`,
              );
              this.closeDialog();
              this.loadBookings();
            },
            error: (err) => {
              this.isSaving = false;
              const msg = err?.error?.message;
              this.toast.error(
                'Error al crear turno fijo',
                Array.isArray(msg)
                  ? msg.join(' ')
                  : (msg ?? 'Intente nuevamente.'),
              );
            },
          }),
      );
      return;
    }

    const dto: CreateBookingDto = {
      courtId: this.selectedSlot.court.id,
      date: this.selectedDate,
      hour: this.selectedSlot.hour,
      clientName: this.clientName.trim(),
      priceType: this.isTeacherBooking ? 'professor' : this.priceType,
      durationMinutes: this.durationMinutes,
      amountCash: Number(this.pagoEfectivo) || 0,
      amountTransfer: Number(this.pagoTransferencia) || 0,
      items: this.cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };
    if (this.isTeacherBooking && this.selectedTeacherId) {
      dto.teacherId = this.selectedTeacherId;
    }

    this.sub.add(
      this.bookingsService.create(dto).subscribe({
        next: (booking) => {
          this.isSaving = false;
          this.addToBookingMap(booking);
          this.draftService.clearDraft(this.DRAFT_KEY_BOOKING);
          this.showBookingDraftBanner = false;
          this.toast.success(
            'Reserva guardada',
            `Turno de ${booking.clientName} en ${booking.court.name} a las ${booking.hour}hs`,
          );
          this.closeDialog();
        },
        error: (err) => {
          this.isSaving = false;
          if (err.status === 409) {
            this.toast.error(
              'Turno ocupado',
              'Ese horario ya fue reservado. Actualizando grilla...',
            );
            this.loadBookings();
          } else if (err.error?.errorCode === 'CAJA_CERRADA') {
            Swal.fire({
              icon: 'warning',
              title: '¡Caja Cerrada!',
              text: 'Necesitas abrir un turno en la caja para poder registrar cobros.',
              showCancelButton: true,
              confirmButtonText: 'Ir a Abrir Caja',
              cancelButtonText: 'Cancelar',
              confirmButtonColor: '#4f46e5',
            }).then((result) => {
              if (result.isConfirmed) {
                this.router.navigate(['/app/cash-register']);
              }
            });
          } else if (err.status === 400) {
            this.toast.error(
              'Stock insuficiente',
              err.error?.message ?? 'Verificá el stock de productos.',
            );
          } else {
            this.toast.error(
              'Error',
              err.error?.message ?? 'No se pudo guardar la reserva.',
            );
          }
        },
      }),
    );
  }

  /** Registra el pago (efectivo/transferencia) SIN cambiar estado ni items. */
  saveDetailChanges(): void {
    const prevCash = Number(this.selectedBooking?.payment?.amountCash ?? 0);
    const newCash = Math.max(0, this.totalPagadoEfectivo);
    if (!this.isCashRegisterOpen && newCash > prevCash) {
      Swal.fire({
        title: '¡Caja Cerrada!',
        text: 'Necesitas abrir un turno en la caja para poder registrar pagos en efectivo.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ir a Abrir Caja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5',
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/app/cash-register']);
        }
      });
      return;
    }

    if (!this.selectedBooking || this.isSavingDetail) return;
    this.isSavingDetail = true;

    // Construir items con el estado isPaid actualizado.
    // - Modo pago rápido: selectedForPayment marca items como pagados.
    // - Modo split 'court': solo committedBySplit marca items como pagados.
    // - Modo split 'court+items': todos los items se marcan pagados cuando todos los jugadores pagaron.
    const allPlayersPaid =
      this.detailPaymentTab === 'split' &&
      this.splitMode === 'court+items' &&
      this.detailPaidCount >= this.detailPlayerCount;
    const cartAfterPayment = this.detailCart.map((i) => ({
      ...i,
      isPaid:
        i.isPaid ||
        (this.detailPaymentTab !== 'split' && i.selectedForPayment === true) ||
        allPlayersPaid,
    }));
    const groupedPaidPay = new Map<string, number>();
    const groupedUnpaidPay = new Map<string, number>();
    for (const i of cartAfterPayment) {
      if (i.isPaid) {
        groupedPaidPay.set(
          i.productId,
          (groupedPaidPay.get(i.productId) ?? 0) + i.quantity,
        );
      } else {
        groupedUnpaidPay.set(
          i.productId,
          (groupedUnpaidPay.get(i.productId) ?? 0) + i.quantity,
        );
      }
    }
    const dto: UpdateBookingDto = {
      amountCash: Math.max(0, this.totalPagadoEfectivo),
      amountTransfer: Math.max(0, this.totalPagadoTransferencia),
      items: [
        ...Array.from(groupedPaidPay, ([productId, quantity]) => ({
          productId,
          quantity,
          isPaid: true,
        })),
        ...Array.from(groupedUnpaidPay, ([productId, quantity]) => ({
          productId,
          quantity,
          isPaid: false,
        })),
      ],
    };

    this.sub.add(
      this.bookingsService.update(this.selectedBooking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;

          this.detailCart = this.detailCart.map((i) => ({
            ...i,
            isPaid: i.isPaid || i.selectedForPayment === true,
            selectedForPayment: false,
            committedBySplit: false,
          }));

          this.playerPaymentHistory = [];
          this.partialCashCount = 0;
          this.partialTransferCount = 0;
          this.selectedConsumableKeys = new Set();

          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;

          const dbCash = Number(updated.payment?.amountCash ?? 0);
          const dbTransfer = Number(updated.payment?.amountTransfer ?? 0);

          this.savedAmountCash = dbCash;
          this.savedAmountTransfer = dbTransfer;
          this.detailAmountCash = 0;
          this.detailAmountTransfer = 0;
          const dbTotal = dbCash + dbTransfer;
          const costPerPlayer =
            this.detailPlayerCount > 0
              ? this.detailTotalReserva / this.detailPlayerCount
              : 1;
          this.detailPaidCount =
            costPerPlayer > 0
              ? Math.min(
                  Math.round(dbTotal / costPerPlayer),
                  this.detailPlayerCount,
                )
              : 0;
          this.initialPaidCount = this.detailPaidCount;

          this.toast.success(
            'Pago registrado',
            `Pagaron ${this.detailPaidCount}/${this.detailPlayerCount} jugadores.`,
          );
        },
        error: (err) => {
          this.isSavingDetail = false;
          this.toast.error(
            'Error',
            err.error?.message ?? 'No se pudo guardar el pago.',
          );
        },
      }),
    );
  }

  /**
   * Llamado cuando se tilda/destilda un producto.
   * Si la selección pasa de 0 a 1, hace scroll suave al panel de cobro parcial
   * para que el cajero lo vea sin tener que scrollear manualmente.
   */
  /** Actualiza la cantidad de jugadores y dispara el auto-save con debounce. */
  changePlayerCount(newCount: number): void {
    this.detailPlayerCount = newCount;
    this.playerCountSave$.next(newCount);
  }

  toggleDetailCartItem(index: number, checked: boolean): void {
    this.detailCart = this.detailCart.map((item, i) =>
      i === index ? { ...item, selectedForPayment: checked } : item,
    );
    this.onProductCheckChange();
  }

  onProductCheckChange(): void {
    if (this.selectedProductsCount === 1) {
      setTimeout(() => {
        this.cobroParcialPanel?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  }

  /** Paso 1: el cajero elige el método de pago para los productos tildados (sin enviar al backend). */
  selectProductPaymentMethod(method: 'cash' | 'transfer'): void {
    this.pendingProductPaymentMethod =
      this.pendingProductPaymentMethod === method ? null : method;
  }

  /** Paso 2: confirma y persiste el cobro de los productos tildados con el método elegido. */
  confirmProductPayment(): void {
    const method = this.pendingProductPaymentMethod;
    if (!method || !this.selectedBooking || this.isSavingDetail) return;

    const amount = this.pendingProductPaymentAmount;

    // Marcar los ítems seleccionados como pagados en el carrito local
    const updatedCart = this.detailCart.map((i) =>
      !i.isPaid && i.selectedForPayment
        ? { ...i, isPaid: true, selectedForPayment: false }
        : i,
    );
    this.pendingProductPaymentMethod = null;

    // Calcular los montos acumulados a enviar al backend
    const newCash =
      method === 'cash' ? this.savedAmountCash + amount : this.savedAmountCash;
    const newTransfer =
      method === 'transfer'
        ? this.savedAmountTransfer + amount
        : this.savedAmountTransfer;

    // Construir DTO con items separados por isPaid
    const groupedPaid = new Map<string, number>();
    const groupedUnpaid = new Map<string, number>();
    for (const i of updatedCart) {
      if (i.isPaid) {
        groupedPaid.set(
          i.productId,
          (groupedPaid.get(i.productId) ?? 0) + i.quantity,
        );
      } else {
        groupedUnpaid.set(
          i.productId,
          (groupedUnpaid.get(i.productId) ?? 0) + i.quantity,
        );
      }
    }
    const dto: UpdateBookingDto = {
      amountCash: newCash,
      amountTransfer: newTransfer,
      items: [
        ...Array.from(groupedPaid, ([productId, quantity]) => ({
          productId,
          quantity,
          isPaid: true,
        })),
        ...Array.from(groupedUnpaid, ([productId, quantity]) => ({
          productId,
          quantity,
          isPaid: false,
        })),
      ],
    };

    this.isSavingDetail = true;
    this.sub.add(
      this.bookingsService.update(this.selectedBooking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;
          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;

          // Actualizar carrito desde el servidor (fuente de verdad)
          this.detailCart = updated.items.map((serverItem) => ({
            productId: serverItem.productId,
            name: serverItem.product.name,
            unitPrice: Number(serverItem.unitPrice),
            quantity: serverItem.quantity,
            isPaid: serverItem.isPaid ?? false,
            selectedForPayment: false,
          }));

          // Resetear SOLO los contadores de esta sesión de pago de productos.
          // NO se tocan detailPaidCount, playerPaymentHistory ni partialCounts
          // para no corromper el estado del modo "dividir por jugador".
          this.savedAmountCash = Number(updated.payment?.amountCash ?? 0);
          this.savedAmountTransfer = Number(
            updated.payment?.amountTransfer ?? 0,
          );
          this.detailAmountCash = 0;
          this.detailAmountTransfer = 0;

          this.toast.success(
            'Producto cobrado',
            `$${this.fmt(amount)} registrado.`,
          );
        },
        error: (err) => {
          this.isSavingDetail = false;
          this.toast.error(
            'Error',
            err.error?.message ?? 'No se pudo guardar el cobro.',
          );
        },
      }),
    );
  }

  /** Descarta la selección de productos (destilda todos) y limpia el método pendiente. */
  dismissProductPaymentPrompt(): void {
    this.detailCart = this.detailCart.map((i) =>
      !i.isPaid ? { ...i, selectedForPayment: false } : i,
    );
    this.pendingProductPaymentMethod = null;
  }

  /** Auto-guarda los ítems del carrito de detalle inmediatamente, sin tocar el pago. */
  private autoSaveItems(): void {
    // No hacer auto-save si hay pagos de jugadores pendientes de confirmar,
    // ya que el carrito puede tener ítems partidos (committedBySplit) que el
    // servidor consolidaría y rompería el estado local del split.
    if (this.playerPaymentHistory.length > 0) return;
    if (!this.selectedBooking || this.isAutoSavingItems) return;
    this.isAutoSavingItems = true;

    // Agrupar por (productId, isPaid) por separado para no fusionar items pagados con impagos
    const groupedPaid = new Map<string, number>();
    const groupedUnpaid = new Map<string, number>();
    for (const i of this.detailCart) {
      if (i.isPaid) {
        groupedPaid.set(
          i.productId,
          (groupedPaid.get(i.productId) ?? 0) + i.quantity,
        );
      } else {
        groupedUnpaid.set(
          i.productId,
          (groupedUnpaid.get(i.productId) ?? 0) + i.quantity,
        );
      }
    }
    const dtoItems = [
      ...Array.from(groupedPaid, ([productId, quantity]) => ({
        productId,
        quantity,
        isPaid: true,
      })),
      ...Array.from(groupedUnpaid, ([productId, quantity]) => ({
        productId,
        quantity,
        isPaid: false,
      })),
    ];
    const dto: UpdateBookingDto = { items: dtoItems };

    // Preservar estado local de UI para restaurar tras guardar.
    // Clave compuesta productId_isPaid para distinguir el mismo producto pagado vs impago.
    const prevSelectedForPayment = new Map<string, boolean>();
    const prevCommittedBySplit = new Map<string, boolean>();
    for (const i of this.detailCart) {
      if (!i.isPaid && i.selectedForPayment) {
        prevSelectedForPayment.set(`${i.productId}_${i.isPaid}`, true);
      }
      if (i.committedBySplit) {
        prevCommittedBySplit.set(`${i.productId}_paid`, true);
      }
    }

    this.sub.add(
      this.bookingsService.update(this.selectedBooking.id, dto).subscribe({
        next: (updated) => {
          this.isAutoSavingItems = false;
          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          // Reconstruir carrito desde la respuesta del servidor (incluye isPaid persistido en BD).
          // Restaurar committedBySplit y selectedForPayment del estado local previo.
          this.detailCart = updated.items.map((serverItem) => ({
            productId: serverItem.productId,
            name: serverItem.product.name,
            unitPrice: Number(serverItem.unitPrice),
            quantity: serverItem.quantity,
            isPaid: serverItem.isPaid ?? false,
            committedBySplit: serverItem.isPaid
              ? (prevCommittedBySplit.get(`${serverItem.productId}_paid`) ??
                false)
              : false,
            selectedForPayment:
              !serverItem.isPaid &&
              (prevSelectedForPayment.get(
                `${serverItem.productId}_${serverItem.isPaid}`,
              ) ??
                false),
          }));
          // Los índices pueden haber cambiado tras el rebuild; limpiar selección para evitar
          // que selectedConsumableIndices apunte a ítems incorrectos.
          this.selectedConsumableKeys = new Set();
        },
        error: (err) => {
          this.isAutoSavingItems = false;
          this.toast.error(
            'Error al guardar consumo',
            err.error?.message ?? 'No se pudo guardar.',
          );
        },
      }),
    );
  }

  /** Cambia el estado de la reserva a "jugando". */
  onStartPlaying(booking: BookingResponse): void {
    this.isSavingDetail = true;

    const dto: UpdateBookingDto = {
      status: 'playing',
    };

    this.sub.add(
      this.bookingsService.update(booking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;
          this.removeFromBookingMap(booking);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.notificationService.removeByEntityId(booking.id);
          this.toast.success(
            'Partido iniciado',
            `${booking.clientName} está jugando.`,
          );
        },
        error: (err) => {
          this.isSavingDetail = false;
          this.toast.error(
            'Error',
            err.error?.message ?? 'No se pudo iniciar el partido.',
          );
        },
      }),
    );
  }

  /** Finaliza el turno registrando el pago final y cambiando el estado a "completado". */
  onFinishPlaying(booking: BookingResponse): void {
    this.isSavingDetail = true;

    const dto: UpdateBookingDto = {
      status: 'completed',
      amountCash: Math.max(0, this.totalPagadoEfectivo),
      amountTransfer: Math.max(0, this.totalPagadoTransferencia),
    };

    this.sub.add(
      this.bookingsService.update(booking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;
          this.removeFromBookingMap(booking);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.productsService.clearCache();
          this.toast.success(
            'Turno finalizado',
            `Turno de ${booking.clientName} completado.`,
          );
          this.detailAmountCash = 0;
          this.detailAmountTransfer = 0;
          this.detailPaidCount = this.initialPaidCount;
          this.closeDialog();
        },
        error: (err) => {
          this.isSavingDetail = false;
          this.toast.error(
            'Error',
            err.error?.message ?? 'No se pudo finalizar el turno.',
          );
        },
      }),
    );
  }

  /** Cancela una reserva (solo admins). Evita doble-click con el guard `isSavingDetail`. */
  onCancelBooking(booking: BookingResponse): void {
    if (!this.isAdmin) {
      this.toast.error(
        'Sin permisos',
        'Solo los administradores pueden cancelar reservas pagadas.',
      );
      return;
    }

    if (this.isSavingDetail) return;
    this.isSavingDetail = true;

    this.sub.add(
      this.bookingsService
        .cancel(booking.id)
        .pipe(
          finalize(() => {
            this.isSavingDetail = false;
          }),
        )
        .subscribe({
          next: () => {
            this.removeFromBookingMap(booking);

            if (booking.fixedBookingId) {
              this.notificationService.removeByEntityId(booking.id);
              localStorage.removeItem(
                `wa_clicked_reminder-today-${booking.id}`,
              );
              localStorage.removeItem(
                `wa_clicked_reminder-tomorrow-${booking.id}`,
              );
            }

            const label = booking.fixedBookingId
              ? 'Turno de esta semana cancelado'
              : 'Reserva cancelada';
            this.toast.info(label, `Turno de ${booking.clientName} cancelado.`);
            this.forceCloseDialog();
          },
          error: (err) => {
            this.toast.error(
              'Error',
              err.error?.message ?? 'No se pudo cancelar la reserva.',
            );
          },
        }),
    );
  }

  /** Cancela una reserva directamente desde la grilla deteniendo la propagación del evento. */
  onDeleteFromGrid(booking: BookingResponse, event: Event): void {
    event.stopPropagation();
    this.onCancelBooking(booking);
  }

  /** Agrega un producto al carrito de creación o incrementa su cantidad si ya existe. */
  addToCart(product: Product): void {
    const idx = this.cart.findIndex((i) => i.productId === product.id);

    if (idx >= 0) {
      this.cart = this.cart.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      this.cart = [
        ...this.cart,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
        },
      ];
    }

    this.productSearch = '';
    this.searchResults = [];
  }

  /** Elimina un ítem del carrito de creación por su id de producto. */
  removeFromCart(productId: string): void {
    this.cart = this.cart.filter((i) => i.productId !== productId);
  }

  /** Actualiza la cantidad de un ítem del carrito de creación; lo elimina si la cantidad llega a 0. */
  updateQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.removeFromCart(productId);
    } else {
      this.cart = this.cart.map((i) =>
        i.productId === productId ? { ...i, quantity: qty } : i,
      );
    }
  }

  /** Elimina diacríticos para comparación insensible a tildes. */
  private normalize(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /** Filtra los productos disponibles según el término de búsqueda del formulario de creación (ignora tildes). */
  onSearchChange(): void {
    const term = this.normalize(this.productSearch.trim());
    if (!term) {
      this.searchResults = [];
      return;
    }
    this.searchResults = this.allProducts.filter((p) =>
      this.normalize(p.name).includes(term),
    );
  }

  /** Agrega un producto al carrito de detalle y dispara el auto-guardado. */
  addToDetailCart(product: Product): void {
    const totalInCart = this.detailCart
      .filter((i) => i.productId === product.id)
      .reduce((s, i) => s + i.quantity, 0);

    const isRental = (product.category?.name ?? '')
      .toLowerCase()
      .includes('alquiler');
    if (!isRental && totalInCart >= product.stock) {
      this.toast.info(
        'Stock máximo alcanzado',
        `"${product.name}" tiene ${product.stock} unidades disponibles.`,
      );
      return;
    }

    const unpaidIdx = this.detailCart.findIndex(
      (i) => i.productId === product.id && !i.isPaid,
    );
    if (unpaidIdx >= 0) {
      this.detailCart = this.detailCart.map((i, idx) =>
        idx === unpaidIdx ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      this.detailCart = [
        ...this.detailCart,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
          isPaid: false,
          selectedForPayment: false,
        },
      ];
    }
    this.detailProductSearch = '';
    this.detailSearchResults = [];
    this.autoSaveItems();
  }

  /** Elimina un ítem del carrito de detalle por índice y dispara el auto-guardado. */
  removeFromDetailCartByIndex(index: number): void {
    this.detailCart = this.detailCart.filter((_, i) => i !== index);
    this.autoSaveItems();
  }

  /** Actualiza la cantidad de un ítem del carrito por índice y dispara el auto-guardado. */
  updateDetailQtyByIndex(index: number, qty: number): void {
    if (qty <= 0) {
      this.detailCart = this.detailCart.filter((_, i) => i !== index);
    } else {
      const item = this.detailCart[index];
      if (item) {
        const product = this.allProducts.find((p) => p.id === item.productId);
        if (product) {
          const isRental = (product.category?.name ?? '')
            .toLowerCase()
            .includes('alquiler');
          if (!isRental) {
            const otherQty = this.detailCart
              .filter((it, i) => i !== index && it.productId === item.productId)
              .reduce((s, it) => s + it.quantity, 0);
            const maxAllowed = product.stock - otherQty;
            if (qty > maxAllowed) {
              qty = Math.max(1, maxAllowed);
              this.toast.info(
                'Stock máximo alcanzado',
                `"${product.name}" tiene ${product.stock} unidades disponibles.`,
              );
            }
          }
        }
        this.detailCart = this.detailCart.map((it, i) =>
          i === index ? { ...it, quantity: qty } : it,
        );
      }
    }
    this.autoSaveItems();
  }

  /** Filtra los productos disponibles según el término de búsqueda del formulario de detalle (ignora tildes). */
  onDetailSearchChange(): void {
    const term = this.normalize(this.detailProductSearch.trim());
    if (!term) {
      this.detailSearchResults = [];
      return;
    }
    this.detailSearchResults = this.allProducts.filter((p) =>
      this.normalize(p.name).includes(term),
    );
  }

  @HostListener('document:keydown.escape')
  /** Cierra el diálogo de confirmación o el modal principal al presionar Escape. */
  onEscape(): void {
    if (this.confirmDialogOpen) {
      this.confirmDialogCancel();
      return;
    }
    if (this.isDialogOpen) this.closeDialog();
  }

  /**
   * Registra una reserva en el bookingMap para su slot de inicio y todos los slots
   * de continuación de 30 min que cubre.
   */
  private addToBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const [h, m] = booking.hour.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + duration;

    this.bookingMap.set(`${booking.courtId}-${booking.hour}`, booking);

    for (let minMark = startMin + 30; minMark < endMin; minMark += 30) {
      const rH = Math.floor(minMark / 60) % 24;
      const rM = minMark % 60;
      const slotHour = `${rH.toString().padStart(2, '0')}:${rM.toString().padStart(2, '0')}`;
      const key = `${booking.courtId}-${slotHour}`;
      if (this.bookingMap.has(key)) continue;
      this.bookingMap.set(key, booking);
    }
  }

  /** Elimina una reserva del bookingMap para su slot de inicio y todas sus continuaciones (30 min). */
  private removeFromBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const [h, m] = booking.hour.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + duration;

    this.bookingMap.delete(`${booking.courtId}-${booking.hour}`);

    for (let minMark = startMin + 30; minMark < endMin; minMark += 30) {
      const rH = Math.floor(minMark / 60) % 24;
      const rM = minMark % 60;
      const slotHour = `${rH.toString().padStart(2, '0')}:${rM.toString().padStart(2, '0')}`;
      this.bookingMap.delete(`${booking.courtId}-${slotHour}`);
    }
  }

  /** Devuelve la hora de fin de una reserva a partir de su hora de inicio y duración. */
  getBookingEndHour(booking: BookingResponse): string {
    const [h, m] = booking.hour.split(':').map(Number);
    const totalMin = h * 60 + m + booking.durationMinutes;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  /** Suma el total de ítems consumidos en una reserva. */
  getBookingItemsTotal(booking: BookingResponse): number {
    return booking.items.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity),
      0,
    );
  }

  /** Devuelve el total general de una reserva (cancha + ítems). */
  getBookingTotal(booking: BookingResponse): number {
    return Number(booking.priceAmount) + this.getBookingItemsTotal(booking);
  }

  /** Devuelve el monto ya pagado de una reserva (efectivo + transferencia). */
  getBookingPaid(booking: BookingResponse): number {
    return (
      Number(booking.payment?.amountCash ?? 0) +
      Number(booking.payment?.amountTransfer ?? 0)
    );
  }

  /** Devuelve el saldo pendiente de una reserva. */
  getBookingPending(booking: BookingResponse): number {
    return this.getBookingTotal(booking) - this.getBookingPaid(booking);
  }

  /** Formatea un número usando el locale argentino. */
  fmt(n: number): string {
    return Number(n).toLocaleString('es-AR');
  }

  /** TrackBy para el *ngFor de horas — mejora el rendimiento del renderizado de la grilla. */
  trackByHour(_: number, hour: string): string {
    return hour;
  }
  /** TrackBy para el *ngFor de canchas. */
  trackByCourt(_: number, court: Court): string {
    return court.id;
  }
  /** TrackBy para el *ngFor de ítems del carrito de detalle. */
  trackByProductId(_: number, item: CartItem): string {
    return item.productId;
  }

  /**
   * Inicia el drag-to-scroll solo si el click NO fue sobre una tarjeta
   * de reserva (cdk-drag). De lo contrario, el cdkDrag toma el control.
   */
  onScrollMouseDown(event: MouseEvent): void {
    if ((event.target as Element).closest('.cdk-drag')) return;

    const el = this.scrollContainer.nativeElement;
    this.isScrollDragging = true;
    this.scrollDragStartX = event.pageX - el.getBoundingClientRect().left;
    this.scrollDragOriginLeft = el.scrollLeft;
  }

  /** Cancela el drag-to-scroll cuando el cursor sale del contenedor. */
  onScrollMouseLeave(): void {
    this.isScrollDragging = false;
  }

  /** Finaliza el drag-to-scroll al soltar el botón del mouse. */
  onScrollMouseUp(): void {
    this.isScrollDragging = false;
  }

  /**
   * Desplaza el contenedor en proporción al movimiento del mouse.
   * El multiplicador 1.5 da velocidad de scroll más natural en pantallas grandes.
   */
  onScrollMouseMove(event: MouseEvent): void {
    if (!this.isScrollDragging) return;
    event.preventDefault();

    const el = this.scrollContainer.nativeElement;
    const x = event.pageX - el.getBoundingClientRect().left;
    const walk = (x - this.scrollDragStartX) * 1.5;
    el.scrollLeft = this.scrollDragOriginLeft - walk;
  }

  /** Sincroniza el scroll horizontal del header row con el grid. */
  syncHeaderScroll(): void {
    if (this.headerRow && this.scrollContainer) {
      this.headerRow.nativeElement.scrollLeft =
        this.scrollContainer.nativeElement.scrollLeft;
    }
  }

  /** Marca inicio de arrastre — bloquea clicks accidentales en slots. */
  onDragStarted(): void {
    this.isDragging = true;
  }

  /**
   * Marca fin de arrastre.
   * Se usa un microtask delay para asegurarse de que el click sintético del
   * browser (disparado en el mismo tick que el pointerup) ya haya sido
   * procesado por `onSlotClick` — y bloqueado — antes de resetear el flag.
   */
  onDragEnded(): void {
    requestAnimationFrame(() => {
      this.isDragging = false;
    });
  }

  /**
   * Handler del evento `cdkDropListDropped`.
   * Solo actúa si el origen y el destino son contenedores distintos.
   * Abre el diálogo de intención (Mover / Duplicar).
   */
  onBookingDrop(event: CdkDragDrop<{ courtId: string; hour: string }>): void {
    if (event.previousContainer === event.container) return;

    const booking = event.item.data as BookingResponse;
    if (booking.status === 'completed') return;
    const target = event.container.data;

    this.rescheduleSourceId = booking.id;
    this.rescheduleTargetCourtId = target.courtId;
    this.rescheduleTargetDate = this.selectedDate;
    this.rescheduleTargetHour = target.hour;
    this.rescheduleFromModal = false;

    setTimeout(() => {
      this.zone.run(() => {
        this.rescheduleDialogOpen = true;
      });
    });
  }

  /**
   * Abre el diálogo Mover/Duplicar desde el botón del modal de detalle (fallback móvil).
   * Pre-carga los valores actuales del turno para que el usuario solo elija el destino.
   */
  openRescheduleFromModal(): void {
    if (!this.selectedBooking) return;
    this.rescheduleSourceId = this.selectedBooking.id;
    this.rescheduleTargetCourtId = this.selectedBooking.court?.id ?? '';
    this.rescheduleTargetDate = this.selectedDate;
    this.rescheduleTargetHour = this.selectedBooking.hour;
    this.rescheduleFromModal = true;
    this.rescheduleDialogOpen = true;
  }

  /** Cierra el diálogo sin hacer nada. */
  closeRescheduleDialog(): void {
    this.rescheduleDialogOpen = false;
    this.rescheduleSourceId = '';
  }

  /**
   * Construye y lanza la petición de mover o duplicar según la acción elegida.
   * Si el turno pertenece a una serie fija y la acción es 'move', muestra
   * primero un diálogo de decisión (solo este turno vs. toda la serie).
   */
  confirmReschedule(action: 'move' | 'duplicate'): void {
    if (
      !this.rescheduleTargetCourtId ||
      !this.rescheduleTargetDate ||
      !this.rescheduleTargetHour
    ) {
      this.toast.error(
        'Datos incompletos',
        'Seleccioná la cancha, fecha y hora de destino.',
      );
      return;
    }

    const dto: RescheduleBookingDto = {
      courtId: this.rescheduleTargetCourtId,
      date: this.rescheduleTargetDate,
      hour: this.rescheduleTargetHour,
    };

    const sourceBooking = [...this.bookingMap.values()].find(
      (b) => b.id === this.rescheduleSourceId,
    );
    const isRecurring = action === 'move' && !!sourceBooking?.fixedBookingId;

    if (isRecurring) {
      Swal.fire({
        title: 'Turno recurrente',
        html:
          `<b>${sourceBooking!.clientName}</b> tiene un turno fijo configurado.<br><br>` +
          `¿Querés mover <b>solo esta semana</b> o <b>toda la serie</b> de turnos?`,
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        denyButtonColor: '#0891b2',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Solo esta semana',
        denyButtonText: 'Toda la serie',
        cancelButtonText: 'Cancelar',
        reverseButtons: false,
      }).then((result) => {
        if (result.isConfirmed) {
          this.executeMove(dto);
        } else if (result.isDenied) {
          this.closeRescheduleDialog();
          if (this.rescheduleFromModal) this.forceCloseDialog();
          this.router.navigate(['/app/fixed-bookings']);
          this.toast.info(
            'Editar serie completa',
            'Buscá el turno fijo en la lista y editalo para mover toda la serie.',
          );
        }
      });
      return;
    }

    this.executeMove(dto, action);
  }

  /** Ejecuta la petición HTTP de mover o duplicar el booking. */
  private executeMove(
    dto: RescheduleBookingDto,
    action: 'move' | 'duplicate' = 'move',
  ): void {
    this.isRescheduling = true;
    const request$ =
      action === 'move'
        ? this.bookingsService.move(this.rescheduleSourceId, dto)
        : this.bookingsService.duplicate(this.rescheduleSourceId, dto);

    request$.pipe(finalize(() => (this.isRescheduling = false))).subscribe({
      next: () => {
        const label = action === 'move' ? 'Turno movido' : 'Turno duplicado';
        this.toast.success(label, 'La agenda fue actualizada.');
        this.closeRescheduleDialog();
        if (this.rescheduleFromModal) this.forceCloseDialog();
        this.loadBookings();
      },
      error: (err) => {
        if (err.status === 409) {
          this.toast.error(
            'Slot ocupado',
            'Ese horario ya tiene un turno reservado.',
          );
        } else {
          this.toast.error(
            'Error',
            'No se pudo completar la operación. Intentá de nuevo.',
          );
        }
      },
    });
  }
}
