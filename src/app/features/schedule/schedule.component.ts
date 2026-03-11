import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';

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

  // ── Create form state ────────────────────────────────────────────────────
  clientName = '';
  priceType: PriceType = 'standard';
  cart: CartItem[] = [];
  pagoEfectivo = 0;
  pagoTransferencia = 0;
  productSearch = '';
  searchResults: Product[] = [];

  // ── Detail form state (editable while booked/playing) ────────────────────
  detailCart: CartItem[] = [];
  detailAmountCash = 0;
  detailAmountTransfer = 0;
  detailPlayerCount = 4;
  detailPaidCount = 0;
  readonly MAX_PLAYERS = 12;
  detailProductSearch = '';
  detailSearchResults: Product[] = [];
  isAutoSavingItems = false;

  // ── Confirm dialog (in-app, replaces native browser confirm) ─────────────
  confirmDialogOpen = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';
  private confirmCallback: (() => void) | null = null;

  // Saved payment amounts — used to detect unsaved changes
  private savedAmountCash = 0;
  private savedAmountTransfer = 0;

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

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  get gridColsStyle(): string {
    // Columna de horas con ancho FIJO en px: garantiza que header y filas de datos
    // usen exactamente la misma anchura para la primera columna, independientemente
    // del texto que contenga ("Horario" vs "09:00hs"). Sin esto, el `auto` de CSS
    // grid calcula el ancho por separado en cada grid → desalineación.
    return `80px repeat(${this.courts.length}, minmax(0, 1fr))`;
  }

  get courtPrice(): number {
    return this.PRICES[this.priceType] * (this.durationMinutes / 60);
  }

  get endHour(): string {
    if (!this.selectedSlot) return '';
    const [h, m] = this.selectedSlot.hour.split(':').map(Number);
    const totalMin = h * 60 + m + this.durationMinutes;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  get cartSubtotal(): number {
    return this.cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }

  get totalReserva(): number {
    return this.courtPrice + this.cartSubtotal;
  }

  get totalPagado(): number {
    return (
      (Number(this.pagoEfectivo) || 0) + (Number(this.pagoTransferencia) || 0)
    );
  }

  get saldoPendiente(): number {
    return this.totalReserva - this.totalPagado;
  }

  get balanceClass(): string {
    if (this.saldoPendiente === 0) return 'bg-accent text-accent-foreground';
    if (this.saldoPendiente > 0) return 'bg-destructive/10 text-destructive';
    return 'bg-yellow-500/10 text-yellow-700';
  }

  get balanceText(): string {
    const fmt = (n: number) => n.toLocaleString('es-AR');
    if (this.saldoPendiente === 0) return '✓ Pago Completo';
    if (this.saldoPendiente > 0)
      return `Falta Pagar: $${fmt(this.saldoPendiente)}`;
    return `Vuelto: $${fmt(Math.abs(this.saldoPendiente))}`;
  }

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

  onDateChange(): void {
    this.loadBookings();
  }

  getBooking(courtId: string, hour: string): BookingResponse | undefined {
    return this.bookingMap.get(`${courtId}-${hour}`);
  }

  /** True if this is the FIRST hour slot of a booking (i.e. the booking starts at this hour). */
  isStartSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    return b != null && b.hour === hour;
  }

  /** True if this hour is covered by a multi-slot booking that STARTED at an earlier hour. */
  isContinuationSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    return b != null && b.hour !== hour;
  }

  /** True if this is the LAST hour of a multi-slot booking (for bottom rounding). */
  isLastContinuationSlot(courtId: string, hour: string): boolean {
    const b = this.getBooking(courtId, hour);
    if (!b || b.hour === hour) return false;
    const slots = Math.ceil((b.durationMinutes ?? 60) / 60);
    const [h, m] = b.hour.split(':').map(Number);
    const totalMin = h * 60 + m + (slots - 1) * 60;
    const lastH = Math.floor(totalMin / 60) % 24;
    const lastM = totalMin % 60;
    const lastHour = `${lastH.toString().padStart(2, '0')}:${lastM.toString().padStart(2, '0')}`;
    return hour === lastHour;
  }

  /**
   * Returns border-width + border-radius Tailwind classes to visually connect
   * multi-slot booking cells into a single tall block.
   * - Single slot or available → full border + full rounding (rounded-lg border-2).
   * - Start of multi-slot      → top rounding only, no bottom border.
   * - Middle continuation      → side borders only, no top/bottom border or rounding.
   * - Last continuation        → bottom rounding only, no top border.
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
   * Altura en píxeles de la tarjeta de reserva — proporcional exacta a durationMinutes.
   *
   * GEOMETRÍA (con space-y-2 entre filas):
   *   - Cada fila mide exactamente 96 px (h-24, border-box).
   *   - space-y-2 agrega 8 px de margin-top entre cada par de filas consecutivas.
   *   - La tarjeta es position:absolute dentro del wrapper de la fila de inicio.
   *
   * FÓRMULA:
   *   altura_base = (durationMinutes / 60) * 96          ← proporcional exacta
   *   gaps        = Math.floor(durationMinutes / 60) * 8  ← un gap por cada hora COMPLETA cruzada
   *   total       = altura_base + gaps
   *
   * Ejemplos:
   *    60 min → (60/60)*96 + floor(60/60)*8  =  96 +  8 = 104... NO:
   *             floor(1)*8 = 8  pero 60 min ocupa sólo 1 fila → 0 gaps
   *
   *   CORRECCIÓN: los gaps se cuentan entre filas cruzadas, es decir
   *   floor(durationMinutes / 60) gaps si durationMinutes > 60, 0 si ≤ 60.
   *   Fórmula final: gaps = Math.floor((durationMinutes - 1) / 60) * 8
   *
   *    60 min → (60/60)*96  + floor(59/60)*8  =  96 + 0*8 =  96 px
   *    90 min → (90/60)*96  + floor(89/60)*8  = 144 + 1*8 = 152 px
   *   120 min → (120/60)*96 + floor(119/60)*8 = 192 + 1*8 = 200 px
   *   180 min → (180/60)*96 + floor(179/60)*8 = 288 + 2*8 = 304 px
   */
  getBookingBlockHeight(booking: BookingResponse): number {
    const mins = booking.durationMinutes ?? 60;
    const baseHeight = (mins / 60) * 96;
    const gaps = Math.floor((mins - 1) / 60) * 8;
    return baseHeight + gaps;
  }

  getSlotClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b)
      // Disponible: borde punteado sutil, hover suave
      return 'border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/5';
    if (b.status === 'booked')
      // Reservado: azul primario
      return 'border-primary bg-primary/10 text-primary';
    if (b.status === 'playing')
      // Jugando: verde vibrante — grita ACTIVO
      return 'border-green-500 bg-green-50 text-green-800';
    if (b.status === 'completed')
      // Completado: bloque histórico sólido, inequívocamente inactivo
      return 'border-slate-400 bg-slate-100 text-slate-600';
    return 'border-dashed border-muted-foreground/30';
  }

  // ── Detail mode computed values ─────────────────────────────────────────

  get detailItemsSubtotal(): number {
    return this.detailCart.reduce(
      (sum, i) => sum + Number(i.unitPrice) * Number(i.quantity),
      0,
    );
  }

  /** Total cancha + consumos. Usa Number() para evitar concatenación con strings de PostgreSQL. */
  get detailTotalReserva(): number {
    return (
      Number(this.selectedBooking?.priceAmount ?? 0) + this.detailItemsSubtotal
    );
  }

  get detailTotalPagado(): number {
    return (
      (Number(this.detailAmountCash) || 0) +
      (Number(this.detailAmountTransfer) || 0)
    );
  }

  /** > 0 → deuda; el botón "Finalizar" queda deshabilitado. */
  get detailSaldoPendiente(): number {
    return Math.max(0, this.detailTotalReserva - this.detailTotalPagado);
  }

  get detailBalanceClass(): string {
    if (this.detailSaldoPendiente <= 0)
      return 'bg-green-50 text-green-800 border border-green-200';
    return 'bg-destructive/10 text-destructive';
  }

  get detailBalanceText(): string {
    if (this.detailSaldoPendiente <= 0) return '✓ Pago Completo';
    return `Falta Pagar: $${this.fmt(this.detailSaldoPendiente)}`;
  }

  /** Monto total dividido en partes iguales entre todos los jugadores. */
  get detailCostPerPlayer(): number {
    const n = this.detailPlayerCount || 1;
    return Math.ceil(this.detailTotalReserva / n);
  }

  /** Deuda restante dividida entre los jugadores que AÚN NO pagaron. */
  get detailDebtPerPlayer(): number {
    const remaining = Math.max(
      1,
      this.detailPlayerCount - this.detailPaidCount,
    );
    return Math.ceil(this.detailSaldoPendiente / remaining);
  }

  /** Si hay una seña ya registrada (en DB), hay pago parcial previo. */
  get hasPriorPayment(): boolean {
    return this.savedAmountCash + this.savedAmountTransfer > 0;
  }

  /** Monto que se suma a un input cuando un jugador paga.
   *  Con seña: usa la deuda restante por jugador restante.
   *  Sin seña: usa el costo total por jugador. */
  get perPlayerAmount(): number {
    return this.hasPriorPayment
      ? this.detailDebtPerPlayer
      : this.detailCostPerPlayer;
  }

  // ── Acciones de cobro ────────────────────────────────────────────────────

  addPaidByCash(): void {
    if (
      this.detailPaidCount >= this.detailPlayerCount ||
      this.detailSaldoPendiente <= 0
    )
      return;
    this.detailAmountCash =
      (Number(this.detailAmountCash) || 0) + this.perPlayerAmount;
    this.detailPaidCount++;
  }

  addPaidByTransfer(): void {
    if (
      this.detailPaidCount >= this.detailPlayerCount ||
      this.detailSaldoPendiente <= 0
    )
      return;
    this.detailAmountTransfer =
      (Number(this.detailAmountTransfer) || 0) + this.perPlayerAmount;
    this.detailPaidCount++;
  }

  decPaidCount(): void {
    if (this.detailPaidCount <= 0) return;
    this.detailPaidCount--;
  }

  settleInCash(): void {
    if (this.detailSaldoPendiente <= 0) return;
    this.detailAmountCash =
      (Number(this.detailAmountCash) || 0) + this.detailSaldoPendiente;
    this.detailPaidCount = this.detailPlayerCount;
  }

  settleInTransfer(): void {
    if (this.detailSaldoPendiente <= 0) return;
    this.detailAmountTransfer =
      (Number(this.detailAmountTransfer) || 0) + this.detailSaldoPendiente;
    this.detailPaidCount = this.detailPlayerCount;
  }

  /** Calculates end time from the booking currently shown in the detail dialog. */
  get detailEndHour(): string {
    if (!this.selectedBooking) return '';
    const [h, m] = this.selectedBooking.hour.split(':').map(Number);
    const totalMin = h * 60 + m + (this.selectedBooking.durationMinutes ?? 60);
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  /** Safely sums payment amounts (backend returns them as numeric strings). */
  getPaymentTotal(payment: BookingPayment): number {
    return Number(payment.amountCash) + Number(payment.amountTransfer);
  }

  getStatusLabel(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      booked: 'Reservado',
      playing: 'Jugando',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return map[status] ?? status;
  }

  getStatusBadgeClass(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      booked: 'bg-primary/15 text-primary',
      playing: 'bg-green-100 text-green-800',
      completed: 'bg-slate-200 text-slate-600',
      cancelled: 'bg-destructive/15 text-destructive',
    };
    return map[status] ?? 'bg-muted text-muted-foreground';
  }

  onSlotClick(court: Court, hour: string): void {
    const booking = this.getBooking(court.id, hour);
    if (booking) {
      this.openDetailDialog(court, hour, booking);
    } else {
      this.openCreateDialog(court, hour);
    }
  }

  private openCreateDialog(court: Court, hour: string): void {
    this.dialogMode = 'create';
    this.selectedSlot = { court, hour };
    this.selectedBooking = null;
    this.resetForm();
    this.isDialogOpen = true;
  }

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
    this.detailPaidCount = 0;
    this.detailProductSearch = '';
    this.detailSearchResults = [];
  }

  get hasUnsavedPaymentChanges(): boolean {
    return (
      Number(this.detailAmountCash) !== this.savedAmountCash ||
      Number(this.detailAmountTransfer) !== this.savedAmountTransfer
    );
  }

  closeDialog(): void {
    // Guard: si el confirm ya está abierto, ignorar nuevas llamadas para evitar
    // que el backdrop principal siga disparando closeDialog() mientras el confirm
    // está visible (race condition entre los dos ng-container).
    if (this.confirmDialogOpen) return;

    if (this.dialogMode === 'detail') {
      const hasPaid = this.detailPaidCount > 0;
      const hasPayment = this.hasUnsavedPaymentChanges;

      if (hasPaid || hasPayment) {
        const paidMsg = hasPaid
          ? `${this.detailPaidCount} jugador${this.detailPaidCount > 1 ? 'es' : ''} marcado${this.detailPaidCount > 1 ? 's' : ''} como pagado${this.detailPaidCount > 1 ? 's' : ''}`
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

  confirmDialogAccept(): void {
    this.confirmDialogOpen = false;
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
  }

  confirmDialogCancel(): void {
    this.confirmDialogOpen = false;
    this.confirmCallback = null;
  }

  private forceCloseDialog(): void {
    this.isDialogOpen = false;
    this.productSearch = '';
    this.searchResults = [];
    this.detailCart = [];
    this.detailProductSearch = '';
    this.detailSearchResults = [];
    this.detailPaidCount = 0;
    this.savedAmountCash = 0;
    this.savedAmountTransfer = 0;
  }

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
          this.removeFromBookingMap(this.selectedBooking!);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          // Preserve detailCart (already auto-saved), only refresh payment from server
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

  /** Auto-guarda items del carrito inmediatamente (sin tocar el pago). */
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
          // Rebuild cart from server response so unit prices are authoritative
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
          // Only update status reference — preserve detailCart and payment inputs
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

  onCancelBooking(booking: BookingResponse): void {
    if (!this.isAdmin) {
      this.toast.error(
        'Sin permisos',
        'Solo los administradores pueden cancelar reservas pagadas.',
      );
      return;
    }
    this.sub.add(
      this.bookingsService.cancel(booking.id).subscribe({
        next: () => {
          this.removeFromBookingMap(booking);
          this.toast.info(
            'Reserva cancelada',
            `Turno de ${booking.clientName} cancelado.`,
          );
          this.closeDialog();
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

  onDeleteFromGrid(booking: BookingResponse, event: Event): void {
    event.stopPropagation();
    this.onCancelBooking(booking);
  }

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

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter((i) => i.productId !== productId);
  }

  updateQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.removeFromCart(productId);
    } else {
      this.cart = this.cart.map((i) =>
        i.productId === productId ? { ...i, quantity: qty } : i,
      );
    }
  }

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

  // ── Detail cart methods ───────────────────────────────────────────────────

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

  removeFromDetailCart(productId: string): void {
    this.detailCart = this.detailCart.filter((i) => i.productId !== productId);
    this.autoSaveItems();
  }

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

  /** Adds a booking to bookingMap for its start hour and all covered continuation hours.
   *
   *  Regla anti-sobreescritura:
   *  - El slot de INICIO (i === 0) siempre se asigna (es la fuente de verdad).
   *  - Los slots de CONTINUACIÓN (i > 0) solo se asignan si ese key aún no existe,
   *    evitando que un turno multi-slot pise a un turno independiente que ya estaba
   *    mapeado en esa hora (ej: un turno completado de 60min en la hora cubierta).
   */
  private addToBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const slots = Math.ceil(duration / 60);
    const [h, m] = booking.hour.split(':').map(Number);
    for (let i = 0; i < slots; i++) {
      const totalMin = h * 60 + m + i * 60;
      const slotH = Math.floor(totalMin / 60) % 24;
      const slotM = totalMin % 60;
      const slotHour = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;
      const key = `${booking.courtId}-${slotHour}`;
      // Continuación: no sobreescribir si el slot ya está ocupado por otro booking
      if (i > 0 && this.bookingMap.has(key)) continue;
      this.bookingMap.set(key, booking);
    }
  }

  /** Removes a booking from bookingMap for its start hour and all covered continuation hours. */
  private removeFromBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const slots = Math.ceil(duration / 60);
    const [h, m] = booking.hour.split(':').map(Number);
    for (let i = 0; i < slots; i++) {
      const totalMin = h * 60 + m + i * 60;
      const slotH = Math.floor(totalMin / 60) % 24;
      const slotM = totalMin % 60;
      const slotHour = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;
      this.bookingMap.delete(`${booking.courtId}-${slotHour}`);
    }
  }

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
}
