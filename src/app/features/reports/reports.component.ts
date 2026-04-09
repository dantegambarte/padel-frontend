import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import * as XLSX from 'xlsx';
import { forkJoin, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  takeUntil,
} from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';

import {
  ReportsService,
  RevenueDay,
  PaymentBreakdown,
  ProductRanking,
  TransactionExport,
  GroupBy,
  ExpensesReport,
  ReportsSummaryResponse,
  LowStockProduct,
} from '../../core/services/reports.service';
import { CashService } from '../../core/services/cash.service';
import { ToastService } from '../../core/services/toast.service';

interface Preset {
  id: string;
  label: string;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit, OnDestroy {
  /** Emite el par from/to cada vez que cambia el filtro de período. */
  private readonly filterChange$ = new Subject<{ from: string; to: string }>();
  private readonly destroy$ = new Subject<void>();

  dateFrom = '';
  dateTo = '';
  readonly maxDate = this.localDateStr(new Date());

  readonly presets: Preset[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: 'Esta Semana' },
    { id: 'mes', label: 'Este Mes' },
    { id: 'trimestre', label: 'Trimestre' },
    { id: 'semestre', label: 'Semestre' },
    { id: 'anual', label: 'Anual' },
  ];
  /** Resalta el preset activo; se limpia cuando el usuario edita las fechas manualmente. */
  selectedPreset = 'mes';

  activeTab: number = 0;
  readonly tabs = [
    { label: 'Resumen General' },
    { label: 'Tendencias e Ingresos' },
    { label: 'Desempeño y Productos' },
    { label: 'Movimientos y Export.' },
    { label: 'Egresos' },
  ];

  isLoadingKpis = false;
  isLoadingRanking = false;
  isLoadingTransactions = false;
  isLoadingExpenses = false;

  private kpisLoaded = false;
  private rankingLoaded = false;
  private transactionsLoaded = false;
  private expensesLoaded = false;

  revenueData: RevenueDay[] = [];
  paymentData: PaymentBreakdown | null = null;
  productRanking: ProductRanking[] = [];
  transactions: TransactionExport[] = [];
  expensesReport: ExpensesReport | null = null;
  summaryData: ReportsSummaryResponse | null = null;
  lowStockProducts: LowStockProduct[] = [];

  txFilterType: 'all' | 'booking' | 'sale' = 'all';
  txFilterPayment: 'all' | 'cash' | 'transfer' = 'all';

  isExporting = false;

  cashSession: {
    sessionId: string | null;
    isClosed: boolean;
    sessionDate: string | null;
    openedAt: string | null;
  } | null = null;
  cashSessionLoading = true;

  barChartType = 'bar' as const;
  barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  cashFlowChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  barChartOptions: ChartOptions<'bar'> = this.buildBarChartOptions();

  /** Reconstruye las opciones de los gráficos al cambiar el tamaño de ventana para adaptar el layout a móvil. */
  @HostListener('window:resize')
  onWindowResize(): void {
    this.barChartOptions = this.buildBarChartOptions();
    this.pieChartOptions = this.buildPieChartOptions();
  }

  /** Construye las opciones de Chart.js para el gráfico de barras, adaptando escalas y etiquetas para móvil. */
  private buildBarChartOptions(): ChartOptions<'bar'> {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 640;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: mobile ? 10 : 12 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString('es-AR')}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: mobile ? 90 : 45,
            minRotation: mobile ? 90 : 0,
            font: { size: mobile ? 9 : 11 },
            autoSkip: true,
            maxTicksLimit: mobile ? 6 : 10,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v: any) => `$${Number(v).toLocaleString('es-AR')}`,
            font: { size: mobile ? 10 : 11 },
          },
        },
      },
    };
  }

  pieChartType = 'pie' as const;
  pieChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  pieChartOptions: ChartOptions<'pie'> = this.buildPieChartOptions();

  /** Construye las opciones de Chart.js para el gráfico circular, con leyenda lateral en desktop y pie en móvil. */
  private buildPieChartOptions(): ChartOptions<'pie'> {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 640;
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: mobile ? 'bottom' : 'right',
          labels: {
            font: { size: mobile ? 10 : 12 },
            boxWidth: mobile ? 10 : 14,
          },
        },
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
  }

  constructor(
    private reportsService: ReportsService,
    private cashService: CashService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const range = this.getDateRange('mes');
    this.dateFrom = range.from;
    this.dateTo = range.to;

    this.filterChange$
      .pipe(
        debounceTime(400),
        distinctUntilChanged((a, b) => a.from === b.from && a.to === b.to),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.applyFilters());

    this.loadCashSession();

    this.loadActiveTab();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Suma total de ingresos (alquileres + ventas) del período seleccionado. */
  get totalRevenue(): number {
    return this.revenueData.reduce(
      (s, d) => s + (Number(d.bookings) || 0) + (Number(d.sales) || 0),
      0,
    );
  }

  /** Total de ingresos por reservas de canchas en el período. */
  get totalAlquileres(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.bookings) || 0), 0);
  }

  /** Total de ingresos por ventas de productos en el período. */
  get totalProductos(): number {
    return this.revenueData.reduce((s, d) => s + (Number(d.sales) || 0), 0);
  }

  /** Porcentaje de ingresos por alquileres sobre el total, como string con un decimal. */
  get pctAlquileres(): string {
    return this.totalRevenue > 0
      ? ((this.totalAlquileres / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }

  /** Porcentaje de ingresos por productos sobre el total, como string con un decimal. */
  get pctProductos(): string {
    return this.totalRevenue > 0
      ? ((this.totalProductos / this.totalRevenue) * 100).toFixed(1)
      : '0.0';
  }

  /** Ticket promedio usa la cuenta de transacciones; disponible solo después de cargar tab 3. */
  get ticketPromedio(): number {
    return this.transactions.length > 0
      ? Math.round(this.totalRevenue / this.transactions.length)
      : 0;
  }

  /** Suma de todos los montos en la lista de transacciones cargadas. */
  get transactionTotal(): number {
    return this.transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
  }

  /** Transacciones filtradas por tipo (turno/venta) y método de pago. */
  get filteredTransactions(): TransactionExport[] {
    return this.transactions.filter((tx) => {
      const typeOk =
        this.txFilterType === 'all' || tx.type === this.txFilterType;
      const paymentOk =
        this.txFilterPayment === 'all' ||
        (this.txFilterPayment === 'cash' && Number(tx.cash) > 0) ||
        (this.txFilterPayment === 'transfer' && Number(tx.transfer) > 0);
      return typeOk && paymentOk;
    });
  }

  /** Total monetario de las transacciones filtradas. */
  get filteredTransactionTotal(): number {
    return this.filteredTransactions.reduce(
      (s, t) => s + (Number(t.total) || 0),
      0,
    );
  }

  /** Suma de ingresos de todos los productos del ranking del período. */
  get rankingTotalAmount(): number {
    return this.productRanking.reduce(
      (s, p) => s + (Number(p.revenue) || 0),
      0,
    );
  }

  /** Suma de unidades vendidas de todos los productos del ranking. */
  get rankingTotalUnidades(): number {
    return this.productRanking.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  }

  /** Etiqueta legible del rango de fechas activo. Ej: "01/04/2026 – 30/04/2026". */
  get periodoLabel(): string {
    return `${this.fmtDisplayDate(this.dateFrom)} – ${this.fmtDisplayDate(this.dateTo)}`;
  }

  /** True si alguna de las cuatro secciones está cargando datos del servidor. */
  get isAnyLoading(): boolean {
    return (
      this.isLoadingKpis ||
      this.isLoadingRanking ||
      this.isLoadingTransactions ||
      this.isLoadingExpenses
    );
  }

  /**
   * Rellena dateFrom / dateTo según el preset y emite en el pipeline de debounce.
   * El llamado HTTP se dispara 400 ms después (si el valor cambió).
   */
  setPreset(id: string): void {
    const range = this.getDateRange(id);
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.selectedPreset = id;
    this.filterChange$.next({ from: this.dateFrom, to: this.dateTo });
  }

  /**
   * Llamado por (ngModelChange) de los inputs de fecha.
   * Limpia el preset resaltado y emite en el pipeline de debounce.
   */
  onDateChanged(): void {
    this.selectedPreset = '';
    this.filterChange$.next({ from: this.dateFrom, to: this.dateTo });
  }

  /** Botón explícito: sin esperar debounce, aplica el filtro de inmediato. */
  selectToday(): void {
    const range = this.getDateRange('hoy');
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.selectedPreset = 'hoy';
    this.applyFilters();
  }

  /** Valida el rango de fechas y, si es correcto, recarga la pestaña activa. */
  applyFilters(): void {
    if (!this.dateFrom || !this.dateTo) {
      this.toast.error(
        'Fechas incompletas',
        'Seleccioná una fecha de inicio y una fecha de fin.',
      );
      return;
    }
    if (this.dateFrom > this.dateTo) {
      this.toast.error(
        'Rango inválido',
        'La fecha de inicio no puede ser posterior a la fecha de fin.',
      );
      return;
    }
    this.kpisLoaded = false;
    this.rankingLoaded = false;
    this.transactionsLoaded = false;
    this.expensesLoaded = false;
    this.resetTxFilters();
    this.loadActiveTab();
  }

  /** Cambia la pestaña activa y carga sus datos si aún no están en caché. */
  onTabChange(index: number): void {
    if (this.activeTab === index) return;
    this.activeTab = index;
    this.loadActiveTab();
    setTimeout(() => {
      const btn = document.querySelector<HTMLElement>(
        `[data-tab-index="${index}"]`,
      );
      btn?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, 0);
  }

  /**
   * Determina qué datos necesita la pestaña activa y lanza la petición SOLO si
   * no están ya en memoria para el filtro actual.
   */
  private loadActiveTab(): void {
    switch (this.activeTab) {
      case 0:
      case 1:
        if (!this.kpisLoaded) this.loadKpis();
        break;
      case 2:
        if (!this.rankingLoaded) this.loadRanking();
        break;
      case 3:
        if (!this.transactionsLoaded) this.loadTransactions();
        break;
      case 4:
        if (!this.expensesLoaded) this.loadExpenses();
        break;
    }
  }

  /** Carga KPIs, ingresos, métodos de pago, resumen y stock bajo en paralelo con forkJoin. */
  private loadKpis(): void {
    this.isLoadingKpis = true;
    const groupBy = this.getGroupBy();

    forkJoin({
      revenue: this.reportsService
        .getRevenue(this.dateFrom, this.dateTo, groupBy)
        .pipe(catchError(() => of([]))),
      payment: this.reportsService
        .getPaymentMethods(this.dateFrom, this.dateTo)
        .pipe(catchError(() => of(null))),
      summary: this.reportsService
        .getSummary(this.dateFrom, this.dateTo)
        .pipe(catchError(() => of(null))),
      stock: this.reportsService.getLowStock().pipe(catchError(() => of([]))),
    })
      .pipe(finalize(() => (this.isLoadingKpis = false)))
      .subscribe({
        next: ({ revenue, payment, summary, stock }) => {
          this.revenueData = revenue as RevenueDay[];
          this.paymentData = payment as PaymentBreakdown | null;
          this.summaryData = summary as ReportsSummaryResponse | null;
          this.lowStockProducts = stock as LowStockProduct[];
          this.buildCharts();
          this.kpisLoaded = true;
        },
        error: () =>
          this.toast.error('Error al cargar KPIs', 'Intente nuevamente'),
      });
  }

  /** Carga el ranking de productos más vendidos del período. */
  private loadRanking(): void {
    this.isLoadingRanking = true;
    this.reportsService
      .getProductsRanking(this.dateFrom, this.dateTo)
      .pipe(
        catchError(() => of([])),
        finalize(() => (this.isLoadingRanking = false)),
      )
      .subscribe({
        next: (data) => {
          this.productRanking = data as ProductRanking[];
          this.rankingLoaded = true;
        },
        error: () =>
          this.toast.error('Error al cargar ranking', 'Intente nuevamente'),
      });
  }

  /** Carga el detalle de transacciones del período para exportación y filtros. */
  private loadTransactions(): void {
    this.isLoadingTransactions = true;
    this.reportsService
      .getTransactionsExport(this.dateFrom, this.dateTo)
      .pipe(
        catchError(() => of([])),
        finalize(() => (this.isLoadingTransactions = false)),
      )
      .subscribe({
        next: (data) => {
          this.transactions = data as TransactionExport[];
          this.transactionsLoaded = true;
        },
        error: () =>
          this.toast.error(
            'Error al cargar transacciones',
            'Intente nuevamente',
          ),
      });
  }

  /** Carga el reporte de egresos del período seleccionado. */
  private loadExpenses(): void {
    this.isLoadingExpenses = true;
    this.reportsService
      .getExpenses(this.dateFrom, this.dateTo)
      .pipe(
        catchError(() => of(null)),
        finalize(() => (this.isLoadingExpenses = false)),
      )
      .subscribe({
        next: (data) => {
          this.expensesReport = data as ExpensesReport | null;
          this.expensesLoaded = true;
        },
        error: () =>
          this.toast.error('Error al cargar egresos', 'Intente nuevamente'),
      });
  }

  private static readonly BAR_COLORS = {
    alquileres: '#06b6d4',
    productos: '#f97316',
    income: '#06b6d4',
    expenses: '#ef4444',
  } as const;

  private static readonly PAYMENT_COLORS = {
    cash: '#10b981',
    transfer: '#6366f1',
  } as const;

  /** Actualiza los datasets de Chart.js de ingresos y métodos de pago con los datos cargados. */
  private buildCharts(): void {
    const labels = this.revenueData.map((d) => d.period);

    this.barChartData = {
      labels,
      datasets: [
        {
          data: this.revenueData.map((d) => d.bookings),
          label: 'Alquileres',
          backgroundColor: ReportsComponent.BAR_COLORS.alquileres,
          borderColor: '#0891b2',
          borderRadius: { topLeft: 4, topRight: 4 },
        },
        {
          data: this.revenueData.map((d) => d.sales),
          label: 'Productos',
          backgroundColor: ReportsComponent.BAR_COLORS.productos,
          borderColor: '#ea6c0a',
          borderRadius: { topLeft: 4, topRight: 4 },
        },
      ],
    };

    this.cashFlowChartData = {
      labels,
      datasets: [
        {
          data: this.revenueData.map((d) => d.bookings + d.sales),
          label: 'Ingresos',
          backgroundColor: ReportsComponent.BAR_COLORS.income,
          borderColor: '#0891b2',
          borderRadius: { topLeft: 4, topRight: 4 },
        },
        {
          data: this.revenueData.map((d) => d.expenses ?? 0),
          label: 'Egresos',
          backgroundColor: ReportsComponent.BAR_COLORS.expenses,
          borderColor: '#dc2626',
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
          backgroundColor: [
            ReportsComponent.PAYMENT_COLORS.cash,
            ReportsComponent.PAYMENT_COLORS.transfer,
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    };
  }

  /** Genera y descarga un archivo Excel con los egresos del período activo. */
  exportExpensesExcel(): void {
    if (!this.expensesReport || this.isExporting) return;
    this.isExporting = true;

    const displayFrom = this.fmtDisplayDate(this.dateFrom);
    const displayTo = this.fmtDisplayDate(this.dateTo);
    const generatedAt = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows = this.expensesReport.items.map((e) => ({
      Fecha: e.date,
      Descripción: e.description,
      Categoría: e.category,
      Método: e.paymentMethod,
      'Registrado por': e.createdByUser?.fullName ?? 'Desconocido',
      Monto: e.amount,
    }));
    rows.push({
      Fecha: 'TOTAL',
      Descripción: '',
      Categoría: '',
      Método: '',
      'Registrado por': '',
      Monto: this.expensesReport.totalAmount,
    });

    const headerAoa: (string | number)[][] = [
      [`Reporte de Egresos | Período: ${displayFrom} al ${displayTo}`],
      [`Generado el: ${generatedAt}`],
      [],
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(headerAoa);
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' });
    ws['!cols'] = [
      { wch: 12 },
      { wch: 36 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
    ];

    const moneyFmt = '"$"#,##0.00';
    const dataStart = 5;
    const dataEnd = dataStart + rows.length - 1;
    for (let r = dataStart; r <= dataEnd; r++) {
      const ref = `F${r}`;
      if (ws[ref]) ws[ref].z = moneyFmt;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Egresos');
    XLSX.writeFile(
      wb,
      `Egresos_${this.dateFrom.replace(/-/g, '')}_al_${this.dateTo.replace(/-/g, '')}.xlsx`,
    );

    this.isExporting = false;
    this.toast.success(
      'Excel descargado',
      `Período: ${displayFrom} al ${displayTo}`,
    );
  }

  /** Genera y descarga un CSV con los egresos del período activo. */
  exportExpensesCSV(): void {
    if (!this.expensesReport || this.isExporting) return;

    const header = ['Fecha', 'Descripción', 'Categoría', 'Método', 'Registrado por', 'Monto'];
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = this.expensesReport.items.map((e) => [
      e.date,
      e.description,
      e.category,
      e.paymentMethod,
      e.createdByUser?.fullName ?? 'Desconocido',
      e.amount,
    ]);
    rows.push(['TOTAL', '', '', '', '', this.expensesReport.totalAmount]);

    const csv = [
      header.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Egresos_${this.dateFrom.replace(/-/g, '')}_al_${this.dateTo.replace(/-/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.toast.success(
      'CSV descargado',
      `Período: ${this.fmtDisplayDate(this.dateFrom)} al ${this.fmtDisplayDate(this.dateTo)}`,
    );
  }

  /** Restablece los filtros de tipo y método de pago de la tabla de transacciones. */
  resetTxFilters(): void {
    this.txFilterType = 'all';
    this.txFilterPayment = 'all';
  }

  /** Exporta las transacciones filtradas a un archivo Excel. */
  exportExcel(): void {
    if (this.isExporting) return;

    if (this.transactions.length > 0) {
      this.triggerExcelDownload(this.filteredTransactions);
      return;
    }

    this.isExporting = true;
    this.reportsService
      .getTransactionsExport(this.dateFrom, this.dateTo)
      .pipe(finalize(() => (this.isExporting = false)))
      .subscribe({
        next: (data) => {
          const filtered = data.filter((tx) => {
            const typeOk =
              this.txFilterType === 'all' || tx.type === this.txFilterType;
            const paymentOk =
              this.txFilterPayment === 'all' ||
              (this.txFilterPayment === 'cash' && Number(tx.cash) > 0) ||
              (this.txFilterPayment === 'transfer' && Number(tx.transfer) > 0);
            return typeOk && paymentOk;
          });
          this.triggerExcelDownload(filtered);
        },
        error: () =>
          this.toast.error(
            'Error al exportar',
            'No se pudo generar el reporte',
          ),
      });
  }

  /** Exporta las transacciones filtradas a un archivo CSV con BOM UTF-8. */
  exportCSV(): void {
    if (this.isExporting) return;

    const data =
      this.filteredTransactions.length > 0
        ? this.filteredTransactions
        : this.transactions;

    if (data.length === 0) {
      this.toast.error(
        'Sin datos',
        'No hay transacciones para exportar en el período seleccionado',
      );
      return;
    }

    this.triggerCsvDownload(data);
  }

  /** Construye el string CSV y dispara la descarga en el navegador. */
  private triggerCsvDownload(transactions: TransactionExport[]): void {
    const header = [
      'Fecha',
      'Hora',
      'Tipo',
      'Concepto',
      'Efectivo',
      'Transferencia',
      'Total',
      'Registrado por',
    ];

    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = transactions.map((tx) => [
      tx.date,
      tx.time,
      tx.type === 'booking'
        ? 'Turno'
        : tx.type === 'sale'
          ? 'Venta cantina'
          : tx.type,
      tx.concept,
      Number(tx.cash) || 0,
      Number(tx.transfer) || 0,
      Number(tx.total) || 0,
      tx.createdBy,
    ]);

    const totalEf = transactions.reduce((s, t) => s + (Number(t.cash) || 0), 0);
    const totalTr = transactions.reduce(
      (s, t) => s + (Number(t.transfer) || 0),
      0,
    );
    const totalGe = transactions.reduce(
      (s, t) => s + (Number(t.total) || 0),
      0,
    );
    rows.push(['TOTAL', '', '', '', totalEf, totalTr, totalGe, '']);

    const csv = [
      header.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transacciones_${this.dateFrom.replace(/-/g, '')}_al_${this.dateTo.replace(/-/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.toast.success(
      'CSV descargado',
      `Período: ${this.fmtDisplayDate(this.dateFrom)} al ${this.fmtDisplayDate(this.dateTo)}`,
    );
  }

  /** Construye el archivo Excel de transacciones y dispara la descarga. */
  private triggerExcelDownload(transactions: TransactionExport[]): void {
    const displayFrom = this.fmtDisplayDate(this.dateFrom);
    const displayTo = this.fmtDisplayDate(this.dateTo);
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
            ? 'Venta cantina'
            : tx.type,
      Concepto: tx.concept,
      Efectivo: Number(tx.cash) || 0,
      Transferencia: Number(tx.transfer) || 0,
      Total: Number(tx.total) || 0,
      'Registrado por': tx.createdBy,
    }));

    const totalEf = rows.reduce((s, r) => s + r.Efectivo, 0);
    const totalTr = rows.reduce((s, r) => s + r.Transferencia, 0);
    const totalGe = rows.reduce((s, r) => s + r.Total, 0);
    rows.push({
      Fecha: 'TOTAL',
      Hora: '',
      Tipo: '',
      Concepto: '',
      Efectivo: totalEf,
      Transferencia: totalTr,
      Total: totalGe,
      'Registrado por': '',
    });

    const filterParts: string[] = [];
    if (this.txFilterType !== 'all')
      filterParts.push(
        this.txFilterType === 'booking' ? 'Tipo: Alquileres' : 'Tipo: Ventas',
      );
    if (this.txFilterPayment !== 'all')
      filterParts.push(
        this.txFilterPayment === 'cash'
          ? 'Pago: Efectivo'
          : 'Pago: Transferencia',
      );
    const filterLabel = filterParts.length
      ? ` | Filtros: ${filterParts.join(' + ')}`
      : '';

    const headerAoa: (string | number)[][] = [
      [
        `Reporte de Transacciones | Periodo: ${displayFrom} al ${displayTo}${filterLabel}`,
      ],
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

    const fileSuffix = filterParts.length
      ? `_${filterParts.map((f) => f.replace(/\W+/g, '')).join('_')}`
      : '';
    XLSX.writeFile(
      wb,
      `Transacciones_${this.dateFrom.replace(/-/g, '')}_al_${this.dateTo.replace(/-/g, '')}${fileSuffix}.xlsx`,
    );

    const toastDetail = filterParts.length
      ? `${displayFrom} al ${displayTo} · ${filterParts.join(', ')}`
      : `Período: ${displayFrom} al ${displayTo}`;
    this.toast.success('Reporte Excel descargado', toastDetail);
  }

  /** Formatea un valor numérico al estilo local argentino. Seguro ante null/undefined. */
  fmt(value: number | string | null | undefined): string {
    return (Number(value) || 0).toLocaleString('es-AR');
  }

  /** Formatea un valor como moneda ARS con dos decimales. */
  fmtCurrency(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  /** Evita que el narrowing de templates colapse el tipo de activeTab en comparaciones literales. */
  isTab(n: number): boolean {
    return this.activeTab === n;
  }

  /** Devuelve las clases Tailwind del badge de categoría de egreso. */
  expenseCategoryClass(category: string): string {
    const map: Record<string, string> = {
      Insumos: 'bg-blue-100 text-blue-700',
      Mantenimiento: 'bg-amber-100 text-amber-700',
      Sueldos: 'bg-violet-100 text-violet-700',
      Servicios: 'bg-teal-100 text-teal-700',
      Otro: 'bg-gray-100 text-gray-600',
    };
    return map[category] ?? 'bg-secondary text-secondary-foreground';
  }

  /** Convierte una fecha ISO (YYYY-MM-DD) al formato de pantalla DD/MM/AAAA. */
  private fmtDisplayDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Serializa una fecha a string ISO local (YYYY-MM-DD) sin desfase de zona horaria. */
  private localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Calcula el agrupamiento óptimo (day / week / month) según el span del rango.
   */
  private getGroupBy(): GroupBy {
    if (!this.dateFrom || !this.dateTo) return 'week';
    const from = new Date(this.dateFrom + 'T00:00:00');
    const to = new Date(this.dateTo + 'T00:00:00');
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (days <= 8) return 'day';
    if (days <= 90) return 'week';
    return 'month';
  }

  /** Devuelve el rango `{ from, to }` en formato ISO para un preset nombrado (hoy, semana, mes, etc.). */
  private getDateRange(period: string): { from: string; to: string } {
    const today = new Date();
    const to = this.localDateStr(today);
    let from: Date;

    switch (period) {
      case 'hoy':
        return { from: to, to };
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

  /** Carga el estado de la sesión de caja activa para el banner informativo. */
  private loadCashSession(): void {
    this.cashSessionLoading = true;
    this.cashService
      .getCurrent()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.cashSessionLoading = false;
        this.cashSession = res
          ? {
              sessionId: res.sessionId,
              isClosed: res.isClosed,
              sessionDate: res.sessionDate,
              openedAt: res.openedAt,
            }
          : null;
      });
  }
}
