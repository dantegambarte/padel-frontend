import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { BookingResponse } from '../../../core/models/booking.model';
import { LowStockProduct } from '../../../core/models/product.model';
import { BookingsService } from '../../../core/services/bookings.service';
import { CashService } from '../../../core/services/cash.service';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { NgClass } from '@angular/common';
import { StatCardComponent } from '../components/stat-card/stat-card.component';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-dashboard-employee',
    templateUrl: './dashboard-employee.component.html',
    imports: [
        StatCardComponent,
        RouterLink,
        NgClass,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardEmployeeComponent implements OnInit {
  isLoading = signal(true);

  cashAmount = signal(0);
  upcomingBookings = signal<BookingResponse[]>([]);
  lowStockProducts = signal<LowStockProduct[]>([]);

  /**
   * Fecha de hoy en formato YYYY-MM-DD usando hora local
   * para evitar el desfase provocado por UTC-3.
   */
  private today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  constructor(
    private bookingsService: BookingsService,
    private cashService: CashService,
    private productsService: ProductsService,
    private toast: ToastService,
  ) {}

  /**
   * Carga en paralelo la caja, las reservas de hoy y los productos con stock bajo.
   * El error de caja no cancela el `forkJoin` gracias al `catchError`.
   */
  ngOnInit(): void {
    this.isLoading.set(true);

    const cash$ = this.cashService
      .getCurrent()
      .pipe(catchError(() => of(null)));

    forkJoin({
      cash: cash$,
      bookings: this.bookingsService.findByDate(this.today),
      lowStock: this.productsService.getLowStock(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ cash, bookings, lowStock }) => {
          this.cashAmount.set(cash?.efectivoEsperado ?? 0);

          this.upcomingBookings.set(
            bookings
              .filter((b) => b.status === 'booked' || b.status === 'playing')
              .sort((a, b) => a.hour.localeCompare(b.hour)),
          );

          this.lowStockProducts.set(lowStock);
        },
        error: () => {
          this.toast.error(
            'Error al cargar el dashboard',
            'Intente recargar la página',
          );
        },
      });
  }

  /** Devuelve la hora del próximo turno o 'Sin turnos' si no hay ninguno. */
  proximoTurnoValue = computed(() => {
    const first = this.upcomingBookings()[0];
    return first ? this.formatHour(first.hour) : 'Sin turnos';
  });

  /** Devuelve el nombre de la cancha del próximo turno. */
  proximoTurnoTrend = computed(() => {
    const first = this.upcomingBookings()[0];
    return first ? first.court.name : '—';
  });

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Devuelve la hora en formato HH:MM tal como viene del backend. */
  formatHour(hour: string): string {
    return hour;
  }

  /** Devuelve `true` si el monto pagado es mayor a cero y cubre el total de la reserva. */
  isPaid(booking: BookingResponse): boolean {
    const totalPaid =
      Number(booking.payment?.amountCash ?? 0) +
      Number(booking.payment?.amountTransfer ?? 0);
    return totalPaid > 0 && totalPaid >= Number(booking.priceAmount);
  }
}
