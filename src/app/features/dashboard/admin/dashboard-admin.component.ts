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
  // ── Loading ───────────────────────────────────────────────────────────────────
  isLoading = true;

  // ── Summary data ──────────────────────────────────────────────────────────────
  summary: ReportsSummaryResponse | null = null;

  // ── Chart (ng2-charts + Chart.js) ────────────────────────────────────────────
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

  ngOnInit(): void {
    // ── Lee los colores del tema desde las CSS custom properties de Tailwind v4.
    // getComputedStyle lee los valores CALCULADOS de :root.
    // Retorna la string completa 'oklch(L C H)' que Canvas 2D acepta directamente
    // en Chrome 111+, Firefox 113+ y Safari 15.4+ (browsers objetivo del proyecto).
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--primary').trim(); // oklch(0.42 0.15 281)
    const accentColor = style.getPropertyValue('--accent').trim(); // oklch(0.55 0.16 155)

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

  // ── Chart builder ─────────────────────────────────────────────────────────────
  private buildChart(
    data: RevenueDay[],
    primaryColor: string,
    accentColor: string,
  ): void {
    this.barChartData = {
      labels: data.map((d) => d.period),
      datasets: [
        {
          data: data.map((d) => d.bookings),
          label: 'Alquileres',
          backgroundColor: primaryColor,
          borderRadius: { topLeft: 4, topRight: 4 },
        },
        {
          data: data.map((d) => d.sales),
          label: 'Productos',
          backgroundColor: accentColor,
          borderRadius: { topLeft: 4, topRight: 4 },
        },
      ],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Rango lunes–domingo de la semana actual en formato YYYY-MM-DD. */
  private getCurrentWeekRange(): { from: string; to: string } {
    const now = new Date();
    const day = now.getDay(); // 0=dom, 1=lun…
    const diffToMonday = day === 0 ? -6 : 1 - day; // ajuste a lunes
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0],
    };
  }
}
