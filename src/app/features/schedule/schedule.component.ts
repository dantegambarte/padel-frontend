import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CourtsService } from '../../core/services/courts.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ProductsService } from '../../core/services/products.service';
import { ToastService } from '../../core/services/toast.service';

import { Court } from '../../core/models/court.model';
import { Product } from '../../core/models/product.model';
import {
  BookingResponse,
  BookingPayment,
  BookingStatus,
  PriceType,
  CreateBookingDto,
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

  selectedDate = new Date().toISOString().split('T')[0];
  courts: Court[] = [];
  featuredProducts: Product[] = [];
  isLoading = false;
  loadError = '';

  bookingMap = new Map<string, BookingResponse>();

  readonly HOURS = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
  ];

  readonly PRICES: Record<PriceType, number> = {
    standard: 3000,
    professor: 2500,
  };

  readonly DURATION_OPTIONS = [
    { value: 30,  label: '30 min'  },
    { value: 60,  label: '1 hora'  },
    { value: 90,  label: '1:30 hs' },
    { value: 120, label: '2 hs'    },
  ];

  durationMinutes = 60;

  isDialogOpen = false;
  isSaving = false;

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

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private courtsService: CourtsService,
    private bookingsService: BookingsService,
    private productsService: ProductsService,
    private toast: ToastService,
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
    return `auto repeat(${this.courts.length}, minmax(0, 1fr))`;
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
    return (Number(this.pagoEfectivo) || 0) + (Number(this.pagoTransferencia) || 0);
  }

  get saldoPendiente(): number {
    return this.totalReserva - this.totalPagado;
  }

  get balanceClass(): string {
    if (this.saldoPendiente === 0) return 'bg-accent text-accent-foreground';
    if (this.saldoPendiente > 0)  return 'bg-destructive/10 text-destructive';
    return 'bg-yellow-500/10 text-yellow-700';
  }

  get balanceText(): string {
    const fmt = (n: number) => n.toLocaleString('es-AR');
    if (this.saldoPendiente === 0) return '✓ Pago Completo';
    if (this.saldoPendiente > 0)  return `Falta Pagar: $${fmt(this.saldoPendiente)}`;
    return `Vuelto: $${fmt(Math.abs(this.saldoPendiente))}`;
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.loadError = '';

    this.sub.add(
      forkJoin({
        courts: this.courtsService.findAll(),
        products: this.productsService.getFeatured(),
      }).subscribe({
        next: ({ courts, products }) => {
          this.courts = courts.filter(c => c.isActive);
          this.featuredProducts = products;
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
          bookings.forEach(b => {
            if (b.status !== 'cancelled') {
              this.addToBookingMap(b);
            }
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toast.error('Error', 'No se pudieron cargar las reservas del día.');
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
    if (b.hour === hour)                          return 'rounded-t-lg rounded-b-none border-t-2 border-l-2 border-r-2';
    if (this.isLastContinuationSlot(courtId, hour)) return 'rounded-t-none rounded-b-lg border-b-2 border-l-2 border-r-2';
    return 'rounded-none border-l-2 border-r-2';
  }

  getSlotClass(courtId: string, hour: string): string {
    const b = this.getBooking(courtId, hour);
    if (!b)                       return 'border-dashed border-muted-foreground/30 hover:border-primary/50';
    if (b.status === 'booked')    return 'border-primary bg-primary/10';
    if (b.status === 'playing')   return 'border-accent bg-accent/10';
    if (b.status === 'completed') return 'border-muted-foreground/30 bg-muted/30';
    return 'border-dashed border-muted-foreground/30';
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
      booked: 'Reservado', playing: 'Jugando',
      completed: 'Completado', cancelled: 'Cancelado',
    };
    return map[status] ?? status;
  }

  getStatusBadgeClass(status: BookingStatus): string {
    const map: Record<BookingStatus, string> = {
      booked:    'bg-primary/15 text-primary',
      playing:   'bg-accent/15 text-accent-foreground',
      completed: 'bg-muted text-muted-foreground',
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

  private openDetailDialog(court: Court, hour: string, booking: BookingResponse): void {
    this.dialogMode = 'detail';
    this.selectedSlot = { court, hour };
    this.selectedBooking = booking;
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
    this.productSearch = '';
    this.searchResults = [];
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
      this.toast.error('Campo requerido', 'Por favor ingresá el nombre del cliente.');
      return;
    }

    this.isSaving = true;

    const dto: CreateBookingDto = {
      courtId:        this.selectedSlot.court.id,
      date:           this.selectedDate,
      hour:           this.selectedSlot.hour,
      clientName:     this.clientName.trim(),
      priceType:      this.priceType,
      durationMinutes: this.durationMinutes,
      amountCash:     Number(this.pagoEfectivo)      || 0,
      amountTransfer: Number(this.pagoTransferencia) || 0,
      items:          this.cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
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
            this.toast.error('Turno ocupado', 'Ese horario ya fue reservado. Actualizando grilla...');
            this.loadBookings();
          } else if (err.status === 503) {
            this.toast.error('Caja cerrada', 'La caja del día ya fue cerrada. No se aceptan nuevas operaciones.');
          } else if (err.status === 400) {
            this.toast.error('Stock insuficiente', err.error?.message ?? 'Verificá el stock de productos.');
          } else {
            this.toast.error('Error', err.error?.message ?? 'No se pudo guardar la reserva.');
          }
        },
      }),
    );
  }

  onStartPlaying(booking: BookingResponse): void {
    this.sub.add(
      this.bookingsService.updateStatus(booking.id, { status: 'playing' }).subscribe({
        next: (updated) => {
          this.removeFromBookingMap(booking);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.toast.success('Partido iniciado', `${booking.clientName} está jugando.`);
        },
        error: (err) => {
          this.toast.error('Error', err.error?.message ?? 'No se pudo iniciar el partido.');
        },
      }),
    );
  }

  onFinishPlaying(booking: BookingResponse): void {
    this.sub.add(
      this.bookingsService.updateStatus(booking.id, { status: 'completed' }).subscribe({
        next: (updated) => {
          this.removeFromBookingMap(booking);
          this.addToBookingMap(updated);
          this.selectedBooking = updated;
          this.toast.success('Turno finalizado', `Turno de ${booking.clientName} completado.`);
        },
        error: (err) => {
          this.toast.error('Error', err.error?.message ?? 'No se pudo finalizar el turno.');
        },
      }),
    );
  }

  onCancelBooking(booking: BookingResponse): void {
    if (!this.isAdmin) {
      this.toast.error('Sin permisos', 'Solo los administradores pueden cancelar reservas pagadas.');
      return;
    }
    this.sub.add(
      this.bookingsService.cancel(booking.id).subscribe({
        next: () => {
          this.removeFromBookingMap(booking);
          this.toast.info('Reserva cancelada', `Turno de ${booking.clientName} cancelado.`);
          this.closeDialog();
        },
        error: (err) => {
          this.toast.error('Error', err.error?.message ?? 'No se pudo cancelar la reserva.');
        },
      }),
    );
  }

  onDeleteFromGrid(booking: BookingResponse, event: Event): void {
    event.stopPropagation();
    this.onCancelBooking(booking);
  }

  addToCart(product: Product): void {
    const idx = this.cart.findIndex(i => i.productId === product.id);

    if (idx >= 0) {
      this.cart = this.cart.map(i =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      this.cart = [
        ...this.cart,
        {
          productId: product.id,
          name:      product.name,
          unitPrice: product.salePrice,
          quantity:  1,
        },
      ];
    }

    this.productSearch = '';
    this.searchResults = [];
  }

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter(i => i.productId !== productId);
  }

  updateQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.removeFromCart(productId);
    } else {
      this.cart = this.cart.map(i =>
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
    this.searchResults = this.featuredProducts.filter(p =>
      p.name.toLowerCase().includes(term),
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  /** Adds a booking to bookingMap for its start hour and all covered continuation hours. */
  private addToBookingMap(booking: BookingResponse): void {
    const duration = booking.durationMinutes ?? 60;
    const slots = Math.ceil(duration / 60);
    const [h, m] = booking.hour.split(':').map(Number);
    for (let i = 0; i < slots; i++) {
      const totalMin = h * 60 + m + i * 60;
      const slotH = Math.floor(totalMin / 60) % 24;
      const slotM = totalMin % 60;
      const slotHour = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;
      this.bookingMap.set(`${booking.courtId}-${slotHour}`, booking);
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

  trackByHour(_: number, hour: string): string { return hour; }
  trackByCourt(_: number, court: Court): string { return court.id; }
  trackByProductId(_: number, item: CartItem): string { return item.productId; }
}
