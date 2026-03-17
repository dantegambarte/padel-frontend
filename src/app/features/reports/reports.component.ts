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
import { CashService } from '../../core/services/cash.service';
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

  /** Datos de la última sesión de caja para el banner informativo. */
  cashSession: {
    sessionId: string | null;
    isClosed: boolean;
    sessionDate: string | null;
    openedAt: string | null;
  } | null = null;
  cashSessionLoading = true;

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
    private cashService: CashService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadCashSession();
  }

  /** Suma total de ingresos (alquileres + ventas) del período seleccionado. */
  get totalRevenue(): number {
    return this.revenueData.reduce(
      (s, d) => s + (Number(d.bookings) || 0) + (Number(d.sales) || 0),
      0,
    );
  }

  /** Total de ingresos por alquileres del período. */
  get totalAlquileres(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.bookings) || 0), 0);
  }

  /** Total de ingresos por ventas de productos del período. */
  get totalProductos(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.sales) || 0), 0);
  }

  /** Porcentaje de ingresos por alquileres sobre el total. */
  get pctAlquileres(): string {
    return this.totalRevenue > 0
      ? ((this.totalAlquileres / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }

  /** Porcentaje de ingresos por productos sobre el total. */
  get pctProductos(): string {
    return this.totalRevenue > 0
      ? ((this.totalProductos / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }

  /** Ticket promedio por transacción. */
  get ticketPromedio(): number {
    return this.transactions.length > 0
      ? Math.round(this.totalRevenue / this.transactions.length)
      : 0;
  }

  /** Suma total de todas las transacciones del período. */
  get transactionTotal(): number {
    return this.transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
  }

  /** Monto total generado por el ranking de productos. */
  get rankingTotalAmount(): number {
    return this.productRanking.reduce(
      (s, p) => s + (Number(p.revenue) || 0),
      0,
    );
  }

  /** Cantidad total de unidades vendidas en el ranking. */
  get rankingTotalUnidades(): number {
    return this.productRanking.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  }

  /** True cuando el botón "Hoy" está activo (filtro de día exacto = hoy). */
  get isTodayActive(): boolean {
    return this.dateFilterActive && this.selectedDate === this.maxDate;
  }

  /** Activa el filtro de día exacto con la fecha de hoy y recarga. */
  selectToday(): void {
    this.selectedDate = this.maxDate;
    this.dateFilterActive = true;
    this.loadAll();
  }

  /** Selecciona un período y recarga los datos. Desactiva el filtro de día exacto. */
  selectPeriod(id: string): void {
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

  /** Carga todos los datos del reporte en paralelo usando el período y filtro de fecha actuales. */
  private loadAll(): void {
    const range = this.getDateRange(this.selectedPeriod);
    this.dateFrom = range.from;
    this.dateTo = range.to;

    const groupBy = this.dateFilterActive
      ? 'day'
      : this.getGroupBy(this.selectedPeriod);
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

  /** Construye los datasets para el gráfico de barras y el de torta con los colores del tema. */
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
            this.paymentData?.cash?.total ?? 0,
            this.paymentData?.transfer?.total ?? 0,
          ],
          backgroundColor: [accentColor, primaryColor],
          hoverOffset: 8,
        },
      ],
    };
  }

  /** Exporta las transacciones del período actual a un archivo Excel (.xlsx). */
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

  /**
   * Genera el archivo Excel a partir de las transacciones.
   * - Hoja encabezada con título documental y período activo.
   * - Nombre de archivo dinámico que incluye el rango de fechas.
   * - Formato de moneda aplicado a las columnas numéricas.
   */
  private triggerExcelDownload(transactions: TransactionExport[]): void {
    const effectiveFrom =
      this.dateFilterActive && this.selectedDate
        ? this.selectedDate
        : this.dateFrom;
    const effectiveTo =
      this.dateFilterActive && this.selectedDate
        ? this.selectedDate
        : this.dateTo;

    const displayFrom = this.fmtDisplayDate(effectiveFrom);
    const displayTo = this.fmtDisplayDate(effectiveTo);
    const generatedAt = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows = transactions.map((tx) => ({
      Fecha: tx.date,
      Hora: tx.time,
      Tipo:
        tx.type === 'booking'
          ? 'Turno'
          : tx.type === 'sale'
            ? 'Venta mostrador'
            : tx.type,
      Concepto: tx.concept,
      Efectivo: Number(tx.cash) || 0,
      Transferencia: Number(tx.transfer) || 0,
      Total: Number(tx.total) || 0,
      'Registrado por': tx.createdBy,
    }));

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

    const headerAoa: (string | number)[][] = [
      [`Reporte de Transacciones | Periodo: ${displayFrom} al ${displayTo}`],
      [`Generado el: ${generatedAt}`],
      [],
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerAoa);
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' });

    ws['!cols'] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 18 },
      { wch: 36 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
    ];

    const moneyFmt = '"$"#,##0.00';
    const dataStart = 5;
    const dataEnd = dataStart + rows.length - 1;
    ['E', 'F', 'G'].forEach((col) => {
      for (let r = dataStart; r <= dataEnd; r++) {
        const ref = `${col}${r}`;
        if (ws[ref]) ws[ref].z = moneyFmt;
      }
    });

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Financiero');

    const fileFrom = effectiveFrom.replace(/-/g, '');
    const fileTo = effectiveTo.replace(/-/g, '');
    XLSX.writeFile(wb, `Transacciones_${fileFrom}_al_${fileTo}.xlsx`);

    this.toast.success(
      'Reporte Excel descargado',
      `Período: ${displayFrom} al ${displayTo}`,
    );
  }

  /**
   * Devuelve la fecha en formato YYYY-MM-DD usando la hora local del navegador,
   * evitando el desfase de UTC-3 que produce toISOString() después de las 21hs.
   */
  private localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Calcula el rango de fechas (from/to) correspondiente al período indicado. */
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

  /** Devuelve el agrupamiento de datos (day/week/month) adecuado para el período. */
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

  /**
   * Etiqueta legible del período activo para mostrar en la UI y en el Excel.
   * Ejemplos:
   *   "Día exacto: 17/03/2026"
   *   "Esta Semana: 11/03/2026 – 17/03/2026"
   *   "Este Mes: 01/03/2026 – 17/03/2026"
   */
  get periodoLabel(): string {
    if (this.dateFilterActive && this.selectedDate) {
      return `Día exacto: ${this.fmtDisplayDate(this.selectedDate)}`;
    }
    const nombre =
      this.periods.find((p) => p.id === this.selectedPeriod)?.label ?? '';
    return `${nombre}: ${this.fmtDisplayDate(this.dateFrom)} – ${this.fmtDisplayDate(this.dateTo)}`;
  }

  /** Formatea un número como string con el locale argentino. */
  fmt(value: number | string | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }

  /** Convierte YYYY-MM-DD → DD/MM/YYYY para mostrar en UI y documentos. */
  private fmtDisplayDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Carga el estado de la última sesión de caja para mostrar el banner informativo.
   * Se ejecuta en paralelo con loadAll() y falla silenciosamente para no bloquear
   * la carga del reporte en caso de que el endpoint de caja no responda.
   */
  private loadCashSession(): void {
    this.cashSessionLoading = true;
    this.cashService
      .getCurrent()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.cashSessionLoading = false;
        this.cashSession = res
          ? {
              sessionId:   res.sessionId,
              isClosed:    res.isClosed,
              sessionDate: res.sessionDate,
              openedAt:    res.openedAt,
            }
          : null;
      });
  }
}
