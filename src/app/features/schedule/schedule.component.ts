import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { AuthService } from '../../core/services/auth.service';
import { CourtsService } from '../../core/services/courts.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ProductsService } from '../../core/services/products.service';
import { ToastService } from '../../core/services/toast.service';
import { CalculatorService } from '../../core/services/calculator.service';

import { Court } from '../../core/models/court.model';
import { Product } from '../../core/models/product.model';
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
}

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
})
export class ScheduleComponent implements OnInit, OnDestroy {
  selectedDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  courts: Court[] = [];
  allProducts: Product[] = [];

  /** Productos marcados como destacados, disponibles para agregar rápidamente. */
  get featuredProducts(): Product[] {
    return this.allProducts.filter((p) => p.isFeatured);
  }
  isLoading = false;
  loadError = '';

  bookingMap = new Map<string, BookingResponse>();

  readonly HOURS = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
  ];

  readonly PRICES: Record<PriceType, number> = {
    standard: 3000,
    professor: 2500,
  };

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

  dialogMode: 'create' | 'detail' = 'create';

  selectedSlot: { court: Court; hour: string } | null = null;
  selectedBooking: BookingResponse | null = null;

  clientName = '';
  priceType: PriceType = 'standard';
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

  confirmDialogOpen = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  private confirmCallback: (() => void) | null = null;

  // ── Diálogo Mover / Duplicar ──────────────────────────────────────────────
  /** Turno pendiente de mover/duplicar (drag-drop o botón móvil). */
  rescheduleDialogOpen = false;
  /** `true` cuando el diálogo es iniciado desde el botón móvil dentro del modal de detalle. */
  rescheduleFromModal = false;
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
  private playerPaymentHistory: { method: 'cash' | 'transfer'; amount: number }[] = [];
  /** Contadores por método para el deshacer selectivo. */
  partialCashCount = 0;
  partialTransferCount = 0;

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private courtsService: CourtsService,
    private bookingsService: BookingsService,
    private productsService: ProductsService,
    private toast: ToastService,
    public calcService: CalculatorService,
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
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

  /** Precio de la cancha según el tipo de precio y la duración seleccionada. */
  get courtPrice(): number {
    return this.PRICES[this.priceType] * (this.durationMinutes / 60);
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

  /** Carga canchas y productos en paralelo, luego dispara la carga de reservas del día. */
  private loadInitialData(): void {
    this.isLoading = true;
    this.loadError = '';

    this.sub.add(
      forkJoin({
        courts: this.courtsService.findAll(),
        products: this.productsService.findAll(),
      }).subscribe({
        next: ({ courts, products }) => {
          this.courts = courts.filter((c) => c.isActive);
          this.allProducts = products.filter((p) => p.isActive);
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
  loadBookings(): void {
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

  /** True si este slot es la última fila de continuación de una reserva multi-hora. */
  isLastContinuationSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    if (!b || b.hour === hour) return false;
    const [bh, bm] = b.hour.split(':').map(Number);
    const endMin = bh * 60 + bm + (b.durationMinutes ?? 60);
    const lastContinuationH = Math.floor((endMin - 1) / 60);
    const lastContinuationHour = `${lastContinuationH.toString().padStart(2, '0')}:00`;
    return hour === lastContinuationHour;
  }

  /**
   * Devuelve la reserva que inicia a HH:30 dentro de la fila de hora entera indicada.
   * Ejemplo: `getBookingAtHalf(courtId, '14:00')` busca la clave `courtId-14:30`.
   */
  getBookingAtHalf(courtId: string, hour: string): BookingResponse | undefined {
    const hh = hour.split(':')[0];
    return this.bookingMap.get(`${courtId}-${hh}:30`);
  }

  /** Offset superior en px para la tarjeta de reserva: 48 px si inicia a :30, 0 si a :00. */
  getBookingTopOffset(booking: BookingResponse): number {
    const minutes = parseInt(booking.hour.split(':')[1], 10);
    return minutes === 30 ? 48 : 0;
  }

  /**
   * Devuelve clases Tailwind de borde y redondeo para conectar visualmente los slots
   * de una reserva multi-hora en un bloque continuo.
   */
  getSlotConnectClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b) return 'rounded-lg border-2';
    const slots = Math.ceil((b.durationMinutes ?? 60) / 60);
    if (slots <= 1) return 'rounded-lg border-2';
    if (b.hour === hour)
      return 'rounded-t-lg rounded-b-none border-t-2 border-l-2 border-r-2';
    if (this.isLastContinuationSlot(courtId, hour))
      return 'rounded-t-none rounded-b-lg border-b-2 border-l-2 border-r-2';
    return 'rounded-none border-l-2 border-r-2';
  }

  /**
   * Altura en píxeles de la tarjeta de reserva, proporcional a `durationMinutes`.
   *
   * FÓRMULA: `(mins / 60) * 96 + floor((mins - 1) / 60) * 8`
   * donde 96 px es la altura de cada fila y 8 px es el gap entre filas (space-y-2).
   */
  getBookingBlockHeight(booking: BookingResponse): number {
    const mins = booking.durationMinutes ?? 60;
    const baseHeight = (mins / 60) * 96;
    const gaps = Math.floor((mins - 1) / 60) * 8;
    return baseHeight + gaps;
  }

  /** Devuelve las clases CSS del slot según su estado (disponible, reservado, jugando, completado). */
  getSlotClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b)
      return 'border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/5';
    if (b.status === 'booked')
      return 'border-primary bg-primary/10 text-primary';
    if (b.status === 'playing')
      return 'border-green-500 bg-green-50 text-green-800';
    if (b.status === 'completed')
      return 'border-slate-400 bg-slate-100 text-slate-600';
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
    return (
      (Number(this.detailAmountCash) || 0) +
      (Number(this.detailAmountTransfer) || 0)
    );
  }

  /** Saldo pendiente en el modo detalle. Nunca negativo; mayor a 0 bloquea el botón "Finalizar". */
  get detailSaldoPendiente(): number {
    return Math.max(0, this.detailTotalReserva - this.detailTotalPagado);
  }

  /** Clases CSS del badge de balance en el modo detalle. */
  get detailBalanceClass(): string {
    if (this.detailSaldoPendiente <= 0)
      return 'bg-green-50 text-green-800 border border-green-200';
    return 'bg-destructive/10 text-destructive';
  }

  /** Texto del badge de balance en el modo detalle. */
  get detailBalanceText(): string {
    if (this.detailSaldoPendiente <= 0) return '✓ Pago Completo';
    return `Falta Pagar: $${this.fmt(this.detailSaldoPendiente)}`;
  }

  /** Monto total dividido en partes iguales entre todos los jugadores. */
  get detailCostPerPlayer(): number {
    const n = this.detailPlayerCount || 1;
    return Math.ceil(this.detailTotalReserva / n);
  }

  /** Deuda restante dividida entre los jugadores que aún no pagaron. */
  get detailDebtPerPlayer(): number {
    const remaining = Math.max(
      1,
      this.detailPlayerCount - this.detailPaidCount,
    );
    return Math.ceil(this.detailSaldoPendiente / remaining);
  }

  /** `true` si ya existe un pago parcial previo registrado en la base de datos. */
  get hasPriorPayment(): boolean {
    return this.savedAmountCash + this.savedAmountTransfer > 0;
  }

  /**
   * Monto que se suma al input de pago cuando un jugador paga.
   * Con seña previa usa la deuda por jugador restante; sin seña usa el costo total por jugador.
   */
  get perPlayerAmount(): number {
    return this.hasPriorPayment
      ? this.detailDebtPerPlayer
      : this.detailCostPerPlayer;
  }

  /** Registra el pago en efectivo de un jugador e incrementa el contador de pagados. */
  addPaidByCash(): void {
    if (
      this.detailPaidCount >= this.detailPlayerCount ||
      this.detailSaldoPendiente <= 0
    )
      return;
    const amount = this.perPlayerAmount;
    this.detailAmountCash = (Number(this.detailAmountCash) || 0) + amount;
    this.playerPaymentHistory.push({ method: 'cash', amount });
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
    const amount = this.perPlayerAmount;
    this.detailAmountTransfer = (Number(this.detailAmountTransfer) || 0) + amount;
    this.playerPaymentHistory.push({ method: 'transfer', amount });
    this.partialTransferCount++;
    this.detailPaidCount++;
  }

  /**
   * Deshace el último pago del método indicado buscando en el historial LIFO.
   * Revierte el monto y decrementa los contadores correspondientes.
   */
  undoPartialPayment(method: 'cash' | 'transfer'): void {
    if (this.detailPaidCount <= 0) return;
    // Buscar el último entry del método indicado
    const idx = [...this.playerPaymentHistory].reverse().findIndex(e => e.method === method);
    if (idx === -1) return;
    const realIdx = this.playerPaymentHistory.length - 1 - idx;
    const entry = this.playerPaymentHistory.splice(realIdx, 1)[0];
    if (method === 'cash') {
      this.detailAmountCash = Math.max(0, (Number(this.detailAmountCash) || 0) - entry.amount);
      this.partialCashCount = Math.max(0, this.partialCashCount - 1);
    } else {
      this.detailAmountTransfer = Math.max(0, (Number(this.detailAmountTransfer) || 0) - entry.amount);
      this.partialTransferCount = Math.max(0, this.partialTransferCount - 1);
    }
    this.detailPaidCount--;
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
      booked: 'bg-primary/15 text-primary',
      playing: 'bg-green-100 text-green-800',
      completed: 'bg-slate-200 text-slate-600',
      cancelled: 'bg-destructive/15 text-destructive',
    };
    return map[status] ?? 'bg-muted text-muted-foreground';
  }

  /**
   * Maneja el click sobre un slot de la grilla.
   * Si hay una reserva iniciando en ese slot, abre el detalle; si está libre, abre el formulario de creación.
   * Los slots de continuación (donde la reserva inició antes) son ignorados.
   */
  onSlotClick(court: Court, hour: string, minutes: '00' | '30' = '00'): void {
    const fullHour = minutes === '30' ? `${hour.split(':')[0]}:30` : hour;
    const booking = this.getBooking(court.id, fullHour);
    if (booking && booking.hour === fullHour) {
      this.openDetailDialog(court, fullHour, booking);
    } else if (!booking) {
      this.openCreateDialog(court, fullHour);
    }
  }

  /** Abre el diálogo en modo creación para el slot indicado. */
  private openCreateDialog(court: Court, hour: string): void {
    this.dialogMode = 'create';
    this.selectedSlot = { court, hour };
    this.selectedBooking = null;
    this.resetForm();
    this.isDialogOpen = true;
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
    this.detailCart = booking.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
    }));
    this.detailAmountCash = Number(booking.payment?.amountCash ?? 0);
    this.detailAmountTransfer = Number(booking.payment?.amountTransfer ?? 0);
    this.savedAmountCash = this.detailAmountCash;
    this.savedAmountTransfer = this.detailAmountTransfer;
    this.detailPlayerCount = 4;

    // Infiere cuántos jugadores ya pagaron a partir del monto guardado en DB.
    // Esto restaura el estado visual al reabrir un turno con pago parcial.
    const savedTotal =
      Number(booking.payment?.amountCash ?? 0) +
      Number(booking.payment?.amountTransfer ?? 0);
    if (savedTotal > 0) {
      const itemsSubtotal = this.detailCart.reduce(
        (s, i) => s + i.unitPrice * i.quantity,
        0,
      );
      const totalBooking = Number(booking.priceAmount ?? 0) + itemsSubtotal;
      const costPerPlayer =
        this.detailPlayerCount > 0 ? totalBooking / this.detailPlayerCount : 1;
      this.detailPaidCount = costPerPlayer > 0
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
    this.initialPaidCount = this.detailPaidCount;
    this.detailProductSearch = '';
    this.detailSearchResults = [];
  }

  /** `true` si los montos de pago actuales difieren del snapshot guardado en DB. */
  get hasUnsavedPaymentChanges(): boolean {
    return (
      Number(this.detailAmountCash) !== this.savedAmountCash ||
      Number(this.detailAmountTransfer) !== this.savedAmountTransfer
    );
  }

  /**
   * Cierra el diálogo. Si hay pagos sin guardar o jugadores marcados como pagados,
   * muestra un diálogo de confirmación antes de cerrar.
   */
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
  }

  /** Resetea el formulario de creación a sus valores iniciales. */
  private resetForm(): void {
    this.clientName = '';
    this.priceType = 'standard';
    this.durationMinutes = 60;
    this.cart = [];
    this.pagoEfectivo = 0;
    this.pagoTransferencia = 0;
    this.productSearch = '';
    this.searchResults = [];
  }

  /** Valida el formulario y envía la petición de creación de reserva al servidor. */
  saveBooking(): void {
    if (!this.selectedSlot || this.isSaving) return;

    if (!this.clientName.trim()) {
      this.toast.error(
        'Campo requerido',
        'Por favor ingresá el nombre del cliente.',
      );
      return;
    }

    this.isSaving = true;

    const dto: CreateBookingDto = {
      courtId: this.selectedSlot.court.id,
      date: this.selectedDate,
      hour: this.selectedSlot.hour,
      clientName: this.clientName.trim(),
      priceType: this.priceType,
      durationMinutes: this.durationMinutes,
      amountCash: Number(this.pagoEfectivo) || 0,
      amountTransfer: Number(this.pagoTransferencia) || 0,
      items: this.cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    this.sub.add(
      this.bookingsService.create(dto).subscribe({
        next: (booking) => {
          this.isSaving = false;
          this.addToBookingMap(booking);
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
          } else if (err.status === 503) {
            this.toast.error(
              'Caja cerrada',
              'La caja del día ya fue cerrada. No se aceptan nuevas operaciones.',
            );
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
    if (!this.selectedBooking || this.isSavingDetail) return;
    this.isSavingDetail = true;

    const dto: UpdateBookingDto = {
      amountCash: Math.max(0, Number(this.detailAmountCash) || 0),
      amountTransfer: Math.max(0, Number(this.detailAmountTransfer) || 0),
    };

    this.sub.add(
      this.bookingsService.update(this.selectedBooking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;
          this.savedAmountCash = Number(this.detailAmountCash) || 0;
          this.savedAmountTransfer = Number(this.detailAmountTransfer) || 0;
          this.detailPaidCount = 0;
          this.playerPaymentHistory = [];
          this.partialCashCount = 0;
          this.partialTransferCount = 0;
          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          const cash = Number(updated.payment?.amountCash ?? 0);
          const transfer = Number(updated.payment?.amountTransfer ?? 0);
          this.detailAmountCash = cash;
          this.detailAmountTransfer = transfer;
          this.savedAmountCash = cash;
          this.savedAmountTransfer = transfer;
          this.toast.success(
            'Pago registrado',
            `Pagaron ${this.detailPaidCount === 0 ? 'todos' : 'algunos'} los jugadores.`,
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

  /** Auto-guarda los ítems del carrito de detalle inmediatamente, sin tocar el pago. */
  private autoSaveItems(): void {
    if (!this.selectedBooking || this.isAutoSavingItems) return;
    this.isAutoSavingItems = true;

    const dto: UpdateBookingDto = {
      items: this.detailCart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    this.sub.add(
      this.bookingsService.update(this.selectedBooking.id, dto).subscribe({
        next: (updated) => {
          this.isAutoSavingItems = false;
          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.detailCart = updated.items.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
          }));
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
      amountCash: Number(this.detailAmountCash) || 0,
      amountTransfer: Number(this.detailAmountTransfer) || 0,
    };

    this.sub.add(
      this.bookingsService.update(booking.id, dto).subscribe({
        next: (updated) => {
          this.isSavingDetail = false;
          this.removeFromBookingMap(booking);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.toast.success(
            'Turno finalizado',
            `Turno de ${booking.clientName} completado.`,
          );
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
      this.bookingsService.cancel(booking.id).pipe(
        finalize(() => { this.isSavingDetail = false; }),
      ).subscribe({
        next: () => {
          this.removeFromBookingMap(booking);
          this.toast.info(
            'Reserva cancelada',
            `Turno de ${booking.clientName} cancelado.`,
          );
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

  /** Filtra los productos disponibles según el término de búsqueda del formulario de creación. */
  onSearchChange(): void {
    const term = this.productSearch.trim().toLowerCase();
    if (!term) {
      this.searchResults = [];
      return;
    }
    this.searchResults = this.allProducts.filter((p) =>
      p.name.toLowerCase().includes(term),
    );
  }

  /** Agrega un producto al carrito de detalle y dispara el auto-guardado. */
  addToDetailCart(product: Product): void {
    const idx = this.detailCart.findIndex((i) => i.productId === product.id);
    if (idx >= 0) {
      this.detailCart = this.detailCart.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      this.detailCart = [
        ...this.detailCart,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          quantity: 1,
        },
      ];
    }
    this.detailProductSearch = '';
    this.detailSearchResults = [];
    this.autoSaveItems();
  }

  /** Elimina un ítem del carrito de detalle y dispara el auto-guardado. */
  removeFromDetailCart(productId: string): void {
    this.detailCart = this.detailCart.filter((i) => i.productId !== productId);
    this.autoSaveItems();
  }

  /** Actualiza la cantidad de un ítem del carrito de detalle y dispara el auto-guardado. */
  updateDetailQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.detailCart = this.detailCart.filter(
        (i) => i.productId !== productId,
      );
    } else {
      this.detailCart = this.detailCart.map((i) =>
        i.productId === productId ? { ...i, quantity: qty } : i,
      );
    }
    this.autoSaveItems();
  }

  /** Filtra los productos disponibles según el término de búsqueda del formulario de detalle. */
  onDetailSearchChange(): void {
    const term = this.detailProductSearch.trim().toLowerCase();
    if (!term) {
      this.detailSearchResults = [];
      return;
    }
    this.detailSearchResults = this.allProducts.filter((p) =>
      p.name.toLowerCase().includes(term),
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmDialogOpen) {
      this.confirmDialogCancel();
      return;
    }
    if (this.isDialogOpen) this.closeDialog();
  }

  /**
   * Registra una reserva en el bookingMap para su slot de inicio y todas las filas
   * de continuación de hora entera que cubre.
   *
   * Soporta turnos que inician a :30; las continuaciones son las filas HH:00
   * cuyo inicio en minutos cae dentro del rango `[startMin, endMin)`.
   */
  private addToBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const [h, m] = booking.hour.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin   = startMin + duration;

    this.bookingMap.set(`${booking.courtId}-${booking.hour}`, booking);

    const firstContinuationMin = Math.ceil(startMin / 60) * 60;
    for (let minMark = firstContinuationMin; minMark < endMin; minMark += 60) {
      const rH = Math.floor(minMark / 60) % 24;
      const slotHour = `${rH.toString().padStart(2, '0')}:00`;
      const key = `${booking.courtId}-${slotHour}`;
      if (slotHour === booking.hour) continue;
      if (this.bookingMap.has(key)) continue;
      this.bookingMap.set(key, booking);
    }
  }

  /** Elimina una reserva del bookingMap para su slot de inicio y todas sus continuaciones. */
  private removeFromBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const [h, m] = booking.hour.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin   = startMin + duration;

    this.bookingMap.delete(`${booking.courtId}-${booking.hour}`);

    const firstContinuationMin = Math.ceil(startMin / 60) * 60;
    for (let minMark = firstContinuationMin; minMark < endMin; minMark += 60) {
      const rH = Math.floor(minMark / 60) % 24;
      const slotHour = `${rH.toString().padStart(2, '0')}:00`;
      if (slotHour === booking.hour) continue;
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

  trackByHour(_: number, hour: string): string {
    return hour;
  }
  trackByCourt(_: number, court: Court): string {
    return court.id;
  }
  trackByProductId(_: number, item: CartItem): string {
    return item.productId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRAG & DROP — Mover / Duplicar turno
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera un ID único de `cdkDropList` para cada celda de la grilla.
   * Formato: `drop-{courtId}-{hour}`.
   */
  dropListId(courtId: string, hour: string): string {
    return `drop-${courtId}-${hour}`;
  }

  /**
   * Handler del evento `cdkDropListDropped`.
   * Solo actúa si el origen y el destino son contenedores distintos.
   * Abre el diálogo de intención (Mover / Duplicar).
   */
  onBookingDrop(event: CdkDragDrop<{ courtId: string; hour: string }>): void {
    if (event.previousContainer === event.container) return;

    const booking = event.item.data as BookingResponse;
    const target = event.container.data;

    this.rescheduleSourceId = booking.id;
    this.rescheduleTargetCourtId = target.courtId;
    this.rescheduleTargetDate = this.selectedDate;
    this.rescheduleTargetHour = target.hour;
    this.rescheduleFromModal = false;
    this.rescheduleDialogOpen = true;
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

  /** Construye y lanza la petición de mover o duplicar según la acción elegida. */
  confirmReschedule(action: 'move' | 'duplicate'): void {
    if (!this.rescheduleTargetCourtId || !this.rescheduleTargetDate || !this.rescheduleTargetHour) {
      this.toast.error('Datos incompletos', 'Seleccioná la cancha, fecha y hora de destino.');
      return;
    }

    const dto: RescheduleBookingDto = {
      courtId: this.rescheduleTargetCourtId,
      date: this.rescheduleTargetDate,
      hour: this.rescheduleTargetHour,
    };

    this.isRescheduling = true;
    const request$ = action === 'move'
      ? this.bookingsService.move(this.rescheduleSourceId, dto)
      : this.bookingsService.duplicate(this.rescheduleSourceId, dto);

    request$.pipe(finalize(() => (this.isRescheduling = false))).subscribe({
      next: () => {
        const label = action === 'move' ? 'Turno movido' : 'Turno duplicado';
        this.toast.success(label, 'La agenda fue actualizada.');
        this.closeRescheduleDialog();
        // Si el diálogo fue desde el modal de detalle, cerrarlo también
        if (this.rescheduleFromModal) this.forceCloseDialog();
        this.loadBookings();
      },
      error: (err) => {
        if (err.status === 409) {
          this.toast.error('Slot ocupado', 'Ese horario ya tiene un turno reservado.');
        } else {
          this.toast.error('Error', 'No se pudo completar la operación. Intentá de nuevo.');
        }
      },
    });
  }
}
