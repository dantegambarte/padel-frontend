import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ChartData, ChartOptions, ChartType } from 'chart.js';

import {
  ReportsService,
  RevenueDay,
  PaymentBreakdown,
  ProductRanking,
  TransactionExport,
  GroupBy,
} from '../../core/services/reports.service';
import { ToastService } from '../../core/services/toast.service';

interface Period {
  id: string;
  label: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  readonly periods: Period[] = [
    { id: 'semana', label: 'Esta Semana' },
    { id: 'mes', label: 'Este Mes' },
    { id: 'trimestre', label: 'Trimestre' },
    { id: 'semestre', label: 'Semestre' },
    { id: 'anual', label: 'Anual' },
  ];
  selectedPeriod = 'mes';

  dateFrom = '';
  dateTo = '';

  isLoading = true;
  isExporting = false;

  revenueData: RevenueDay[] = [];
  paymentData: PaymentBreakdown | null = null;
  productRanking: ProductRanking[] = [];
  transactions: TransactionExport[] = [];

  barChartType = 'bar' as const;
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
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
          callback: (v: any) => `$${Number(v).toLocaleString('es-AR')}`,
        },
      },
    },
  };

  pieChartType = 'pie' as const;
  pieChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const data = ctx.dataset.data as number[];
            const total = data.reduce((a, b) => a + (b as number), 0);
            const value = ctx.parsed as number;
            const pct = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
            return ` ${ctx.label}: $${value.toLocaleString('es-AR')} (${pct}%)`;
          },
        },
      },
    },
  };

  constructor(
    private reportsService: ReportsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  get totalRevenue(): number {
    return this.revenueData.reduce(
      (s, d) => s + (Number(d.bookings) || 0) + (Number(d.sales) || 0),
      0,
    );
  }
  get totalAlquileres(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.bookings) || 0), 0);
  }
  get totalProductos(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.sales) || 0), 0);
  }
  get pctAlquileres(): string {
    return this.totalRevenue > 0
      ? ((this.totalAlquileres / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }
  get pctProductos(): string {
    return this.totalRevenue > 0
      ? ((this.totalProductos / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }
  get ticketPromedio(): number {
    return this.transactions.length > 0
      ? Math.round(this.totalRevenue / this.transactions.length)
      : 0;
  }
  get transactionTotal(): number {
    return this.transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
  }
  get rankingTotalAmount(): number {
    return this.productRanking.reduce((s, p) => s + (Number(p.total) || 0), 0);
  }
  get rankingTotalUnidades(): number {
    return this.productRanking.reduce(
      (s, p) => s + (Number(p.unidades) || 0),
      0,
    );
  }

  selectPeriod(id: string): void {
    if (this.selectedPeriod === id) return;
    this.selectedPeriod = id;
    this.loadAll();
  }

  private loadAll(): void {
    const range = this.getDateRange(this.selectedPeriod);
    this.dateFrom = range.from;
    this.dateTo = range.to;
    const groupBy = this.getGroupBy(this.selectedPeriod);

    this.isLoading = true;

    forkJoin({
      revenue: this.reportsService
        .getRevenue(range.from, range.to, groupBy)
        .pipe(catchError(() => of([]))),
      payment: this.reportsService
        .getPaymentMethods(range.from, range.to)
        .pipe(catchError(() => of(null))),
      ranking: this.reportsService
        .getProductsRanking(range.from, range.to)
        .pipe(catchError(() => of([]))),
      transactions: this.reportsService
        .getTransactionsExport(range.from, range.to)
        .pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ revenue, payment, ranking, transactions }) => {
          this.revenueData = revenue as RevenueDay[];
          this.paymentData = payment as PaymentBreakdown | null;
          this.productRanking = ranking as ProductRanking[];
          this.transactions = transactions as TransactionExport[];
          this.buildCharts();
        },
        error: () => {
          this.toast.error(
            'Error al cargar reportes',
            'Intente recargar la página',
          );
        },
      });
  }

  private buildCharts(): void {
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--primary').trim();
    const accentColor = style.getPropertyValue('--accent').trim();

    this.barChartData = {
      labels: this.revenueData.map((d) => d.period),
      datasets: [
        {
          data: this.revenueData.map((d) => d.bookings),
          label: 'Alquileres',
          backgroundColor: primaryColor,
          borderRadius: { topLeft: 4, topRight: 4 },
        },
        {
          data: this.revenueData.map((d) => d.sales),
          label: 'Productos',
          backgroundColor: accentColor,
          borderRadius: { topLeft: 4, topRight: 4 },
        },
      ],
    };

    this.pieChartData = {
      labels: ['Efectivo', 'Transferencia'],
      datasets: [
        {
          data: [
            this.paymentData?.efectivo?.amount ?? 0,
            this.paymentData?.transferencia?.amount ?? 0,
          ],
          backgroundColor: [accentColor, primaryColor],
          hoverOffset: 8,
        },
      ],
    };
  }

  exportCsv(): void {
    if (this.isExporting) return;

    if (this.transactions.length > 0) {
      this.triggerCsvDownload(this.transactions);
      return;
    }

    this.isExporting = true;
    this.reportsService
      .getTransactionsExport(this.dateFrom, this.dateTo)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (data) => this.triggerCsvDownload(data),
        error: () =>
          this.toast.error(
            'Error al exportar',
            'No se pudo generar el reporte',
          ),
      });
  }

  private triggerCsvDownload(transactions: TransactionExport[]): void {
    const headers = [
      'Fecha',
      'Hora',
      'Tipo',
      'Concepto',
      'Efectivo',
      'Transferencia',
      'Total',
      'Registrado por',
    ];
    const rows = transactions.map((tx) => [
      tx.date,
      tx.time,
      tx.type,
      tx.concept,
      tx.cash,
      tx.transfer,
      tx.total,
      tx.createdBy,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const filename = `reporte_financiero_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toast.success(
      'Reporte descargado correctamente',
      'El archivo CSV se ha descargado exitosamente',
    );
  }

  private getDateRange(period: string): { from: string; to: string } {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    let from: Date;

    switch (period) {
      case 'semana':
        from = new Date(today);
        from.setDate(today.getDate() - 6);
        break;
      case 'mes':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'trimestre':
        from = new Date(today);
        from.setMonth(today.getMonth() - 3);
        break;
      case 'semestre':
        from = new Date(today);
        from.setMonth(today.getMonth() - 6);
        break;
      case 'anual':
        from = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        from = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return { from: from.toISOString().split('T')[0], to };
  }

  private getGroupBy(period: string): GroupBy {
    switch (period) {
      case 'semana':
        return 'day';
      case 'mes':
        return 'week';
      case 'trimestre':
        return 'week';
      case 'semestre':
        return 'month';
      case 'anual':
        return 'month';
      default:
        return 'week';
    }
  }

  fmt(value: number | string | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }
}
