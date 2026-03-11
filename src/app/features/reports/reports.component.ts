import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
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

  /** Fecha seleccionada en el calendario (YYYY-MM-DD). Vacía = filtro inactivo. */
  selectedDate = '';
  /** True cuando el usuario eligió un día concreto en el datepicker. */
  dateFilterActive = false;
  /** Fecha máxima permitida en el datepicker: hoy. */
  readonly maxDate = this.localDateStr(new Date());

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
    return this.productRanking.reduce((s, p) => s + (Number(p.revenue) || 0), 0);
  }
  get rankingTotalUnidades(): number {
    return this.productRanking.reduce(
      (s, p) => s + (Number(p.qty) || 0),
      0,
    );
  }

  selectPeriod(id: string): void {
    // Al elegir un período, se desactiva el filtro de día exacto
    this.dateFilterActive = false;
    this.selectedDate = '';
    if (this.selectedPeriod === id) return;
    this.selectedPeriod = id;
    this.loadAll();
  }

  /** Llamado cuando el usuario elige una fecha en el datepicker. */
  onDateChange(value: string): void {
    if (!value) {
      this.clearDateFilter();
      return;
    }
    this.selectedDate = value;
    this.dateFilterActive = true;
    this.loadAll();
  }

  /** Limpia el filtro de día y vuelve al período activo. */
  clearDateFilter(): void {
    this.selectedDate = '';
    this.dateFilterActive = false;
    this.loadAll();
  }

  private loadAll(): void {
    const range = this.getDateRange(this.selectedPeriod);
    this.dateFrom = range.from;
    this.dateTo = range.to;

    // Cuando hay filtro de día exacto, groupBy='day' para que el gráfico muestre esa jornada
    const groupBy = this.dateFilterActive ? 'day' : this.getGroupBy(this.selectedPeriod);
    const date = this.dateFilterActive ? this.selectedDate : undefined;

    this.isLoading = true;

    forkJoin({
      revenue: this.reportsService
        .getRevenue(range.from, range.to, groupBy, date)
        .pipe(catchError(() => of([]))),
      payment: this.reportsService
        .getPaymentMethods(range.from, range.to, date)
        .pipe(catchError(() => of(null))),
      ranking: this.reportsService
        .getProductsRanking(range.from, range.to, date)
        .pipe(catchError(() => of([]))),
      transactions: this.reportsService
        .getTransactionsExport(range.from, range.to, date)
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

  exportExcel(): void {
    if (this.isExporting) return;

    if (this.transactions.length > 0) {
      this.triggerExcelDownload(this.transactions);
      return;
    }

    this.isExporting = true;
    const date = this.dateFilterActive ? this.selectedDate : undefined;
    this.reportsService
      .getTransactionsExport(this.dateFrom, this.dateTo, date)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (data) => this.triggerExcelDownload(data),
        error: () =>
          this.toast.error(
            'Error al exportar',
            'No se pudo generar el reporte',
          ),
      });
  }

  private triggerExcelDownload(transactions: TransactionExport[]): void {
    // 1. Mapear datos con encabezados en español
    const rows = transactions.map((tx) => ({
      Fecha: tx.date,
      Hora: tx.time,
      Tipo: tx.type === 'booking' ? 'Turno' : tx.type === 'sale' ? 'Venta mostrador' : tx.type,
      Concepto: tx.concept,
      Efectivo: Number(tx.cash) || 0,
      Transferencia: Number(tx.transfer) || 0,
      Total: Number(tx.total) || 0,
      'Registrado por': tx.createdBy,
    }));

    // 2. Agregar fila de totales
    const totalEfectivo = rows.reduce((s, r) => s + r.Efectivo, 0);
    const totalTransferencia = rows.reduce((s, r) => s + r.Transferencia, 0);
    const totalGeneral = rows.reduce((s, r) => s + r.Total, 0);

    rows.push({
      Fecha: 'TOTAL',
      Hora: '',
      Tipo: '',
      Concepto: '',
      Efectivo: totalEfectivo,
      Transferencia: totalTransferencia,
      Total: totalGeneral,
      'Registrado por': '',
    });

    // 3. Crear worksheet y workbook
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(rows);

    // 4. Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 },  // Fecha
      { wch: 8 },   // Hora
      { wch: 18 },  // Tipo
      { wch: 36 },  // Concepto
      { wch: 14 },  // Efectivo
      { wch: 16 },  // Transferencia
      { wch: 14 },  // Total
      { wch: 20 },  // Registrado por
    ];

    // 5. Aplicar formato de moneda a columnas numéricas (E, F, G → índices 4,5,6)
    const moneyFmt = '"$"#,##0.00';
    const totalRows = rows.length + 1; // +1 por la fila de encabezado
    ['E', 'F', 'G'].forEach((col) => {
      for (let r = 2; r <= totalRows; r++) {
        const cellRef = `${col}${r}`;
        if (ws[cellRef]) {
          ws[cellRef].z = moneyFmt;
        }
      }
    });

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Financiero');

    // 6. Descargar archivo
    const filename = `Reporte_Financiero_${this.localDateStr(new Date())}.xlsx`;
    XLSX.writeFile(wb, filename);

    this.toast.success(
      'Reporte Excel descargado',
      'El archivo .xlsx se ha generado exitosamente',
    );
  }

  /**
   * Devuelve la fecha en formato YYYY-MM-DD usando la hora LOCAL del navegador,
   * evitando el desfase de UTC-3 que produce toISOString() después de las 21hs.
   */
  private localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getDateRange(period: string): { from: string; to: string } {
    const today = new Date();
    const to = this.localDateStr(today);
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

    return { from: this.localDateStr(from), to };
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
