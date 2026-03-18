import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ChartData, ChartOptions, ChartType } from 'chart.js';

import {
  ReportsService,
  ReportsSummaryResponse,
  RevenueDay,
} from '../../../core/services/reports.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-dashboard-admin',
  templateUrl: './dashboard-admin.component.html',
})
export class DashboardAdminComponent implements OnInit {
  isLoading = true;

  summary: ReportsSummaryResponse | null = null;

  barChartType = 'bar' as const;

  barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Alquileres',
        backgroundColor: '',
        borderRadius: { topLeft: 4, topRight: 4 },
      },
      {
        data: [],
        label: 'Productos',
        backgroundColor: '',
        borderRadius: { topLeft: 4, topRight: 4 },
      },
    ],
  };

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString('es-AR')}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `$${Number(value).toLocaleString('es-AR')}`,
        },
      },
    },
  };

  constructor(
    private reportsService: ReportsService,
    private toast: ToastService,
  ) {}

  /**
   * Carga en paralelo el resumen de KPIs y los ingresos de la semana actual.
   * Lee los colores del tema desde las CSS custom properties de Tailwind v4
   * y los inyecta en el gráfico de barras.
   */
  ngOnInit(): void {
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--primary').trim();
    const accentColor = style.getPropertyValue('--accent').trim();

    const { from, to } = this.getCurrentWeekRange();

    this.isLoading = true;
    forkJoin({
      summary: this.reportsService.getSummary(),
      revenue: this.reportsService.getRevenue(from, to, 'day'),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ summary, revenue }) => {
          this.summary = summary;
          this.buildChart(revenue, primaryColor, accentColor);
        },
        error: () => {
          this.toast.error(
            'Error al cargar el dashboard',
            'Intente recargar la página',
          );
        },
      });
  }

  /**
   * Construye los datasets del gráfico de barras con los datos de ingresos semanales.
   * @param data         - Array de períodos con bookings y sales.
   * @param primaryColor - Color CSS para alquileres.
   * @param accentColor  - Color CSS para productos.
   */
  private buildChart(
    data: RevenueDay[],
    _primaryColor: string,
    _accentColor: string,
  ): void {
    this.barChartData = {
      labels: data.map((d) => d.period),
      datasets: [
        {
          data: data.map((d) => d.bookings),
          label: 'Alquileres',
          backgroundColor: '#06b6d4', // Cyan 500
          borderColor: '#0891b2',     // Cyan 600
          borderRadius: { topLeft: 4, topRight: 4 },
        },
        {
          data: data.map((d) => d.sales),
          label: 'Productos',
          backgroundColor: '#f97316', // Orange 500
          borderColor: '#ea6c0a',     // Orange 600
          borderRadius: { topLeft: 4, topRight: 4 },
        },
      ],
    };
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Devuelve el rango lunes–domingo de la semana actual en formato YYYY-MM-DD. */
  private getCurrentWeekRange(): { from: string; to: string } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const localStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      from: localStr(monday),
      to: localStr(sunday),
    };
  }
}
