import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';

import {
  ReportsService,
  TodayKpis,
  DailyRevenue,
} from '../../../core/services/reports.service';
import { ToastService } from '../../../core/services/toast.service';
import { DecimalPipe } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';

@Component({
    selector: 'app-dashboard-admin',
    templateUrl: './dashboard-admin.component.html',
    imports: [
    NgChartsModule,
    DecimalPipe
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardAdminComponent implements OnInit {
  isLoading = signal(true);

  kpis = signal<TodayKpis | null>(null);

  barChartType = 'bar' as const;

  barChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString('es-AR')}`,
          footer: (items: any[]) => {
            const total = items.reduce((s, i) => s + i.parsed.y, 0);
            return `Total: $${total.toLocaleString('es-AR')}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          callback: (v: any) => `$${Number(v).toLocaleString('es-AR')}`,
        },
      },
    },
  };

  constructor(
    private reportsService: ReportsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.isLoading.set(true);
    forkJoin({
      kpis: this.reportsService.getTodayKpis(),
      chart: this.reportsService.getLast7DaysRevenue(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ kpis, chart }) => {
          this.kpis.set(kpis);
          this.buildChart(chart);
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
   * Construye el gráfico de barras apiladas: Efectivo (verde) + Transferencia (índigo).
   * Las etiquetas del eje X muestran el día en formato DD/MM.
   */
  private buildChart(data: DailyRevenue[]): void {
    const labels = data.map((d) => {
      const [, m, day] = d.date.split('-');
      return `${day}/${m}`;
    });

    this.barChartData.set({
      labels,
      datasets: [
        {
          data: data.map((d) => d.cash),
          label: 'Efectivo',
          backgroundColor: '#10b981',
          borderColor: '#059669',
          borderRadius: { topLeft: 0, topRight: 0 },
        },
        {
          data: data.map((d) => d.transfer),
          label: 'Transferencia',
          backgroundColor: '#6366f1',
          borderColor: '#4f46e5',
          borderRadius: { topLeft: 4, topRight: 4 },
        },
      ],
    });
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }
}
