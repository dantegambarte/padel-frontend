import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { BookingResponse } from '../../../core/models/booking.model';
import { LowStockProduct } from '../../../core/models/product.model';
import { BookingsService } from '../../../core/services/bookings.service';
import { CashService } from '../../../core/services/cash.service';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-dashboard-employee',
  templateUrl: './dashboard-employee.component.html',
})
export class DashboardEmployeeComponent implements OnInit {
  // ── Loading ───────────────────────────────────────────────────────────────────
  isLoading = true;

  // ── Data ──────────────────────────────────────────────────────────────────────
  cashAmount = 0;
  upcomingBookings: BookingResponse[] = [];
  lowStockProducts: LowStockProduct[] = [];

  private today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(); // YYYY-MM-DD hora local (evita desfase UTC-3)

  constructor(
    private bookingsService: BookingsService,
    private cashService: CashService,
    private productsService: ProductsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;

    // Carga paralela — el catchError en cash$ evita que un 404 cancele el forkJoin
    const cash$ = this.cashService
      .getCurrent()
      .pipe(catchError(() => of(null)));

    forkJoin({
      cash: cash$,
      bookings: this.bookingsService.findByDate(this.today),
      lowStock: this.productsService.getLowStock(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ cash, bookings, lowStock }) => {
          this.cashAmount = cash?.efectivoEsperado ?? 0;

          // Solo turnos con status 'booked' o 'playing', ordenados por hora
          this.upcomingBookings = bookings
            .filter((b) => b.status === 'booked' || b.status === 'playing')
            .sort((a, b) => a.hour.localeCompare(b.hour));

          this.lowStockProducts = lowStock;
        },
        error: () => {
          this.toast.error(
            'Error al cargar el dashboard',
            'Intente recargar la página',
          );
        },
      });
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  /** Stat card: próximo turno — hora del primero de la lista. */
  get proximoTurnoValue(): string {
    return this.upcomingBookings[0]
      ? this.formatHour(this.upcomingBookings[0].hour)
      : 'Sin turnos';
  }

  /** Stat card: trend del próximo turno — nombre de cancha. */
  get proximoTurnoTrend(): string {
    return this.upcomingBookings[0] ? this.upcomingBookings[0].court.name : '—';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Devuelve la hora en formato HH:MM. El campo hour ya viene como string 'HH:MM'. */
  formatHour(hour: string): string {
    return hour;
  }

  /** Badge variant para el estado del turno.
   *  Pagado (payment registrado) → 'default' (bg-primary),
   *  Pendiente (sin payment)     → 'secondary'.
   */
  isPaid(booking: BookingResponse): boolean {
    return booking.payment !== null;
  }
}
