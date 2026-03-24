import { Component, HostListener, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CashService,
  CashMovimiento,
  ItemDetail,
  OpenCashDto,
  DailySummaryResponse,
  DailySummaryShift,
} from '../../core/services/cash.service';

/**
 * Vista agrupada de movimientos del turno:
 * - Los turnos (BOOKING) se consolidan por referenceId (bookingId).
 * - Las ventas (SALE) permanecen como filas individuales.
 */
export interface GroupedMovimiento {
  type: 'BOOKING' | 'SALE';
  referenceId: string;
  concepto: string;
  customerName: string | null;
  bookingCourtName: string | null;
  bookingHour: string | null;
  bookingClientName: string | null;
  bookingPriceAmount: number | null;
  saleTotal: number | null;
  items: ItemDetail[];
  itemsTotal: number;
  totalMonto: number;
  totalCash: number;
  totalTransfer: number;
  transactions: CashMovimiento[];
  hasMultiplePayments: boolean;
  firstHora: string;
  userName: string;

  hasCash: boolean;
  hasTransfer: boolean;
  hasCourt: boolean;
  hasCantina: boolean;
}
@Component({
  selector: 'app-cash-register',
  templateUrl: './cash-register.component.html',
})
export class CashRegisterComponent implements OnInit {
  activeTab: 'turno' | 'historial' = 'turno';

  isSessionOpen: boolean | null = null;
  isLoading = true;
  sessionId: string | null = null;
  isClosed = false;
  efectivoEsperado = 0;
  transferenciaTotal = 0;
  initialBalance = 0;
  movimientos: CashMovimiento[] = [];
  sessionDate: string | null = null;
  openedAt: string | null = null;
  openedByName: string | null = null;

  fondoInicial = '';
  notasApertura = '';
  isOpening = false;

  efectivoContado: number | null = null;
  notas = '';
  isDialogOpen = false;
  isSubmitting = false;

  staleSession = false;

  closedCashCounted: number | null = null;
  closedDifference: number | null = null;

  ticketSaleId: string | null = null;

  exportingSessionId: string | null = null;
  exportingDaily = false;

  historialDate = '';
  historialLoading = false;
  dailySummary: DailySummaryResponse | null = null;

  /** Fecha máxima permitida en el datepicker del historial: hoy calendario. */
  get maxDate(): string {
    return this.toISODate(new Date());
  }

  constructor(
    private cashService: CashService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadCurrentSession();
    this.historialDate = this.toISODate(this.logicalCommercialDate);
  }

  /** True cuando el usuario autenticado es administrador. */
  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  /**
   * Fecha comercial que se va a abrir al presionar "Abrir Jornada".
   * Si son menos de las 02:00 hs, el turno pertenece a AYER (margen administrativo post-cierre).
   * Usa la hora local del navegador como aproximación (sin requerir TZ del servidor).
   */
  get logicalCommercialDate(): Date {
    const now = new Date();
    if (now.getHours() < 2) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    return now;
  }

  /**
   * Etiqueta legible de la fecha comercial que se va a abrir.
   * Ej: "viernes, 20 de marzo de 2026".
   */
  get logicalCommercialDateLabel(): string {
    return this.logicalCommercialDate.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * True cuando la hora actual está en la ventana de madrugada (00:00–01:59).
   * Se usa para mostrar la nota aclaratoria en el banner de apertura.
   */
  get isOvernightWindow(): boolean {
    return new Date().getHours() < 2;
  }

  /** Hora actual formateada como HH:MM para el banner de madrugada. */
  get currentTimeLabel(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** Devuelve el nombre completo del usuario autenticado actualmente (quien opera el sistema). */
  get userName(): string {
    return this.authService.currentUser?.fullName ?? 'Usuario';
  }

  /** Nombre a mostrar como cajero del turno: quien abrió la sesión, no quien está logueado ahora. */
  get cajeroActual(): string {
    return this.openedByName ?? this.userName;
  }

  /**
   * Etiqueta del turno activo con la fecha de la sesión.
   * Ej: "Turno del viernes 20 de marzo"
   */
  get jornadaLabel(): string {
    if (!this.sessionDate) return 'Turno de hoy';
    const [year, month, day] = this.sessionDate.split('-').map(Number);
    const sessionDay = new Date(year, month - 1, day);
    return `Turno del ${sessionDay.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })}`;
  }

  /** Suma de efectivo esperado y total de transferencias. */
  get totalEsperado(): number {
    return this.efectivoEsperado + this.transferenciaTotal;
  }

  /** Valor numérico del efectivo contado. Retorna 0 mientras el empleado no ingresa nada. */
  get efectivoReal(): number {
    return this.efectivoContado ?? 0;
  }

  /** Diferencia entre el efectivo real contado y el esperado por el sistema. */
  get diferencia(): number {
    return this.efectivoReal - this.efectivoEsperado;
  }

  /** Valor absoluto de la diferencia. */
  get absD(): number {
    return Math.abs(this.diferencia);
  }

  /** Muestra el panel de diferencia en cuanto el empleado ingresa algún valor (incluso 0). */
  get showDiferencia(): boolean {
    return this.efectivoContado !== null;
  }

  /** Clase CSS para colorear la diferencia según su signo. */
  get diferenciaClass(): string {
    if (this.diferencia === 0) return 'text-accent';
    return this.diferencia > 0 ? 'text-blue-600' : 'text-destructive';
  }

  /** Texto descriptivo de la diferencia con signo. */
  get diferenciaText(): string {
    if (this.diferencia === 0) return '✓ Cuadra';
    const sign = this.diferencia > 0 ? '+' : '';
    return `${sign}$${this.fmt(this.diferencia)}`;
  }

  /** Clases CSS del banner indicador (cuadra vs diferencia). */
  get indicatorClass(): string {
    return this.diferencia === 0
      ? 'border border-accent/50 bg-accent/10 text-accent'
      : 'border border-yellow-500/50 bg-yellow-500/10 text-yellow-700';
  }

  /** Texto descriptivo del tipo de discrepancia (sobrante o faltante). */
  get discrepancyLabel(): string {
    return this.diferencia > 0
      ? `Hay un sobrante de $${this.fmt(this.absD)}`
      : `Falta $${this.fmt(this.absD)}`;
  }

  /**
   * Carga el resumen de la sesión de caja actual desde el servidor.
   * Si no hay sesión activa hoy, setea `isSessionOpen = false`.
   */
  private loadCurrentSession(): void {
    this.isLoading = true;
    this.cashService
      .getCurrent()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          if (res.noSession || res.isClosed) {
            this.isSessionOpen = false;
            return;
          }
          this.isSessionOpen = true;
          this.sessionId = res.sessionId;
          this.isClosed = false;
          this.efectivoEsperado = res.efectivoEsperado;
          this.transferenciaTotal = res.transferenciaTotal;
          this.initialBalance = res.initialBalance;
          this.movimientos = res.movimientos;
          this.sessionDate = res.sessionDate;
          this.openedAt = res.openedAt;
          this.openedByName = res.openedByName;
          this.closedCashCounted = null;
          this.closedDifference = null;
          this.staleSession = false;
        },
        error: () => {
          this.isSessionOpen = false;
          this.toast.error(
            'Error de conexión',
            'No se pudo contactar al servidor. Intente recargar.',
          );
        },
      });
  }

  /**
   * Abre la jornada de caja con el fondo inicial declarado por el empleado.
   * Llama a POST /cash/open y recarga el estado de la sesión.
   */
  abrirJornada(): void {
    const fondo = parseFloat(this.fondoInicial || '0');
    if (isNaN(fondo) || fondo < 0) {
      this.toast.error(
        'Error',
        'El fondo inicial debe ser un número mayor o igual a 0',
      );
      return;
    }
    this.isOpening = true;
    const dto: OpenCashDto = {
      initialBalance: fondo,
      ...(this.notasApertura ? { notes: this.notasApertura } : {}),
    };
    this.cashService
      .open(dto)
      .pipe(finalize(() => (this.isOpening = false)))
      .subscribe({
        next: () => {
          this.fondoInicial = '';
          this.notasApertura = '';
          this.toast.success(
            'Jornada abierta',
            `Fondo inicial: $${this.fmt(fondo)}`,
          );
          this.isSessionOpen = null; // muestra loadingnu
          this.loadCurrentSession();
        },
        error: (err) => {
          const msg: string = err.error?.message ?? 'Intente nuevamente';
          if (err.status === 409) {
            this.toast.error('Conflicto al abrir caja', msg);
            this.loadCurrentSession();
          } else {
            this.toast.error('Error al abrir caja', msg);
          }
        },
      });
  }

  /**
   * Abre el diálogo de confirmación de cierre.
   * Requiere que el empleado haya ingresado el efectivo contado (incluido $0).
   */
  openConfirmDialog(): void {
    if (this.efectivoContado === null) {
      this.toast.error('Error', 'Por favor ingrese el efectivo contado');
      return;
    }
    this.isDialogOpen = true;
  }

  /** Cierra el diálogo de confirmación. */
  closeDialog(): void {
    this.isDialogOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  /**
   * Ejecuta el cierre Z de caja enviando el efectivo contado al servidor.
   * Muestra un toast con el resultado y actualiza el estado local.
   */
  confirmarCierre(): void {
    this.isSubmitting = true;
    this.cashService
      .close({
        efectivoContado: this.efectivoReal,
        notas: this.notas || undefined,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.generateZCloseExcel(
            {
              sessionDate: this.sessionDate,
              openedAt: this.openedAt,
              closedAt: new Date().toISOString(),
              userName: this.userName,
              efectivoEsperado: this.efectivoEsperado,
              transferenciaTotal: this.transferenciaTotal,
              totalSistema: this.totalEsperado,
              efectivoContado: this.efectivoReal,
              diferencia: this.diferencia,
              notas: this.notas,
            },
            this.movimientos,
          );

          this.isDialogOpen = false;
          this.isClosed = true;
          this.staleSession = false;
          this.closedCashCounted = this.efectivoReal;
          this.closedDifference = this.diferencia;

          const detalle =
            this.diferencia === 0
              ? 'Todo cuadra perfectamente.'
              : `Diferencia: $${this.fmt(this.absD)}`;

          this.toast.success(
            'Caja cerrada exitosamente',
            `Cierre Z realizado por ${this.userName}. ${detalle}`,
          );
        },
        error: (err) => {
          if (err.status === 409) {
            this.toast.error(
              'Caja ya cerrada',
              'La sesión de caja ya fue cerrada anteriormente',
            );
            this.isClosed = true;
          } else {
            this.toast.error('Error al cerrar caja', 'Intente nuevamente');
          }
        },
      });
  }

  /**
   * Agrupa los movimientos del turno:
   * - BOOKING: consolidados por bookingId (referenceId), sumando importes.
   * - SALE: filas individuales.
   * El servidor devuelve las transacciones en orden DESC; las invertimos
   * para mantener el orden cronológico dentro de cada grupo.
   */
  get groupedMovimientos(): GroupedMovimiento[] {
    const result: GroupedMovimiento[] = [];
    const txs = [...this.movimientos].reverse();
    const bookingMap = new Map<string, GroupedMovimiento>();

    for (const mov of txs) {
      if (mov.movType === 'BOOKING') {
        const existing = bookingMap.get(mov.referenceId);
        if (existing) {
          existing.totalMonto += mov.monto;
          existing.totalCash += mov.amountCash;
          existing.totalTransfer += mov.amountTransfer;
          existing.transactions.push(mov);
          existing.hasMultiplePayments = true;
          existing.hasCash = existing.hasCash || mov.amountCash > 0;
          existing.hasTransfer = existing.hasTransfer || mov.amountTransfer > 0;
        } else {
          const rawItems = mov.bookingItems ?? [];
          const group: GroupedMovimiento = {
            type: 'BOOKING',
            referenceId: mov.referenceId,
            concepto: mov.concepto,
            customerName: mov.customerName ?? null,
            bookingCourtName: mov.bookingCourtName ?? null,
            bookingHour: mov.bookingHour ?? null,
            bookingClientName: mov.bookingClientName ?? null,
            bookingPriceAmount: mov.bookingPriceAmount ?? null,
            saleTotal: null,
            items: rawItems,
            itemsTotal: rawItems.reduce((s, it) => s + it.total, 0),
            totalMonto: mov.monto,
            totalCash: mov.amountCash,
            totalTransfer: mov.amountTransfer,
            transactions: [mov],
            hasMultiplePayments: false,
            firstHora: mov.hora,
            userName: mov.userName,
            hasCash: mov.amountCash > 0,
            hasTransfer: mov.amountTransfer > 0,
            hasCourt: true,
            hasCantina: rawItems.length > 0,
          };
          bookingMap.set(mov.referenceId, group);
          result.push(group);
        }
      } else {
        const rawItems = mov.saleItems ?? [];
        result.push({
          type: 'SALE',
          referenceId: mov.referenceId,
          concepto: mov.concepto,
          customerName: mov.customerName ?? null,
          bookingCourtName: null,
          bookingHour: null,
          bookingClientName: null,
          bookingPriceAmount: null,
          saleTotal: mov.saleTotal ?? null,
          items: rawItems,
          itemsTotal: rawItems.reduce((s, it) => s + it.total, 0),
          totalMonto: mov.monto,
          totalCash: mov.amountCash,
          totalTransfer: mov.amountTransfer,
          transactions: [mov],
          hasMultiplePayments: false,
          firstHora: mov.hora,
          userName: mov.userName,
          hasCash: mov.amountCash > 0,
          hasTransfer: mov.amountTransfer > 0,
          hasCourt: false,
          hasCantina: rawItems.length > 0,
        });
      }
    }

    return result.reverse();
  }

  /**
   * Abre un modal SweetAlert2 con el detalle completo del movimiento en 3 secciones:
   * 1. Desglose de Productos (si hay ítems)
   * 2. Detalle de Cancha (solo BOOKING)
   * 3. Resumen Financiero (cobros + totales)
   * El botón primario del modal dispara printTicket().
   */
  openTransactionDetail(group: GroupedMovimiento): void {
    const fmt = (n: number) => n.toLocaleString('es-AR');
    const cur = (n: number) => `$${fmt(n)}`;

    let sec1 = '';
    if (group.items.length > 0) {
      const itemRows = group.items
        .map(
          (it) => `
          <tr>
            <td style="padding:5px 6px;font-size:13px;">${it.productName}</td>
            <td style="padding:5px 6px;text-align:center;font-size:13px;">${it.quantity}</td>
            <td style="padding:5px 6px;text-align:right;font-size:13px;">${cur(it.unitPrice)}</td>
            <td style="padding:5px 6px;text-align:right;font-size:13px;font-weight:600;">${cur(it.total)}</td>
          </tr>`,
        )
        .join('');
      sec1 = `
        <div style="margin-bottom:14px;">
          <p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px;">Productos / Consumos</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:5px 6px;text-align:left;font-size:11px;color:#6b7280;">Producto</th>
                <th style="padding:5px 6px;text-align:center;font-size:11px;color:#6b7280;">Cant.</th>
                <th style="padding:5px 6px;text-align:right;font-size:11px;color:#6b7280;">P.Unit.</th>
                <th style="padding:5px 6px;text-align:right;font-size:11px;color:#6b7280;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right;font-size:12px;font-weight:600;color:#374151;margin-top:5px;">
            Subtotal: ${cur(group.itemsTotal)}
          </div>
        </div>`;
    }

    if (group.type === 'BOOKING') {
      const court = group.bookingCourtName ?? '—';
      const hour = group.bookingHour ? `${group.bookingHour}hs` : '—';
      const client = group.bookingClientName ?? group.customerName ?? '—';
      const canchaPrice = group.bookingPriceAmount ?? 0;

      const sec2 = `
        <div style="margin-bottom:14px;padding:10px 12px;background:#eef2ff;border-radius:8px;border:1px solid #c7d2fe;">
          <p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#4f46e5;margin-bottom:7px;">Detalle de Cancha</p>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:13px;">
            <span style="color:#6b7280;">Cancha</span><span style="font-weight:600;">${court}</span>
            <span style="color:#6b7280;">Horario</span><span style="font-weight:600;">${hour}</span>
            <span style="color:#6b7280;">Cliente</span><span style="font-weight:600;">${client}</span>
            <span style="color:#6b7280;">Precio cancha</span><span style="font-weight:600;">${cur(canchaPrice)}</span>
            ${group.itemsTotal > 0 ? `<span style="color:#6b7280;">Extras</span><span style="font-weight:600;">${cur(group.itemsTotal)}</span>` : ''}
          </div>
        </div>`;

      const totalReserva = canchaPrice + group.itemsTotal;
      const cambio =
        group.totalMonto > totalReserva ? group.totalMonto - totalReserva : 0;

      const payRows = group.transactions
        .map((tx, i) => {
          const method =
            tx.amountCash > 0 && tx.amountTransfer > 0
              ? 'Efectivo + Transf.'
              : tx.amountCash > 0
                ? 'Efectivo'
                : 'Transferencia';
          const label = !group.hasMultiplePayments
            ? 'Pago Completo'
            : i === 0
              ? 'Seña / Parcial'
              : i === group.transactions.length - 1
                ? 'Pago Final'
                : 'Pago Parcial';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:7px 10px;margin-bottom:5px;background:#f9fafb;
                        border-radius:6px;border:1px solid #e5e7eb;">
              <div>
                <span style="font-size:13px;color:#374151;font-weight:500;">${tx.hora}hs — ${label}</span>
                <span style="font-size:11px;color:#9ca3af;margin-left:6px;">(${method})</span>
              </div>
              <span style="font-weight:700;font-size:14px;">${cur(tx.monto)}</span>
            </div>`;
        })
        .join('');

      const sec3 = `
        <div>
          <p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px;">Historial de Cobros</p>
          ${payRows}
          <div style="border-top:2px solid #e5e7eb;margin-top:8px;padding-top:8px;">
            ${group.totalCash > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;"><span style="color:#6b7280;">Efectivo</span><span style="font-weight:600;">${cur(group.totalCash)}</span></div>` : ''}
            ${group.totalTransfer > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;"><span style="color:#6b7280;">Transferencia</span><span style="font-weight:600;">${cur(group.totalTransfer)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
              <span style="color:#6b7280;">Cambio</span>
              <span style="font-weight:600;color:#374151;">${cur(cambio)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#059669;margin-top:6px;">
              <span>Total cobrado</span><span>${cur(group.totalMonto)}</span>
            </div>
          </div>
        </div>`;

      Swal.fire({
        title: 'Detalle del Turno',
        html: `<div style="text-align:left;">${sec1}${sec2}${sec3}</div>`,
        confirmButtonText: 'Imprimir',
        confirmButtonColor: '#4f46e5',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        cancelButtonColor: '#6b7280',
        width: 540,
      }).then((r) => {
        if (r.isConfirmed) this.printTicket(group);
      });
    } else {
      const method =
        group.totalCash > 0 && group.totalTransfer > 0
          ? 'Efectivo + Transf.'
          : group.totalCash > 0
            ? 'Efectivo'
            : 'Transferencia';

      const sec3 = `
        <div>
          <p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px;">Resumen de Venta</p>
          <div style="padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="color:#6b7280;">Empleado</span><span style="font-weight:600;">${group.userName}</span>
            </div>
            ${group.customerName ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#6b7280;">Cliente</span><span style="font-weight:600;">${group.customerName}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="color:#6b7280;">Hora</span><span style="font-weight:600;">${group.firstHora}hs</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="color:#6b7280;">Método</span><span style="font-weight:600;">${method}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#059669;margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;">
              <span>Total</span><span>${cur(group.totalMonto)}</span>
            </div>
          </div>
        </div>`;

      Swal.fire({
        title: 'Detalle de Venta',
        html: `<div style="text-align:left;">${sec1}${sec3}</div>`,
        confirmButtonText: 'Imprimir',
        confirmButtonColor: '#4f46e5',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        cancelButtonColor: '#6b7280',
        width: 500,
      }).then((r) => {
        if (r.isConfirmed) this.printTicket(group);
      });
    }
  }

  /**
   * Genera un comprobante HTML e invoca window.print() en una nueva pestaña.
   */
  printTicket(group: GroupedMovimiento): void {
    const fmt = (n: number) => n.toLocaleString('es-AR');
    const cur = (n: number) => `$${fmt(n)}`;
    const now = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    let itemsHtml = '';
    if (group.items.length > 0) {
      const rows = group.items
        .map(
          (it) =>
            `<tr><td>${it.productName}</td><td style="text-align:center;">${it.quantity}</td>` +
            `<td style="text-align:right;">${cur(it.unitPrice)}</td><td style="text-align:right;">${cur(it.total)}</td></tr>`,
        )
        .join('');
      itemsHtml = `
        <h3>Productos</h3>
        <table>
          <tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">P.Unit.</th><th style="text-align:right;">Total</th></tr>
          ${rows}
          <tr style="border-top:1px dashed #ccc;font-weight:700;">
            <td colspan="3">Subtotal productos</td>
            <td style="text-align:right;">${cur(group.itemsTotal)}</td>
          </tr>
        </table>`;
    }

    let bodyHtml = '';
    if (group.type === 'BOOKING') {
      const court = group.bookingCourtName ?? '—';
      const hour = group.bookingHour ? `${group.bookingHour}hs` : '—';
      const client = group.bookingClientName ?? group.customerName ?? '—';
      const canchaPrice = group.bookingPriceAmount ?? 0;
      const payLines = group.transactions
        .map((tx, i) => {
          const method =
            tx.amountCash > 0 && tx.amountTransfer > 0
              ? 'Efectivo + Transf.'
              : tx.amountCash > 0
                ? 'Efectivo'
                : 'Transferencia';
          const label = !group.hasMultiplePayments
            ? 'Pago Completo'
            : i === 0
              ? 'Seña'
              : i === group.transactions.length - 1
                ? 'Pago Final'
                : 'Pago Parcial';
          return `<p>${tx.hora}hs &mdash; ${label} (${method}): <strong>${cur(tx.monto)}</strong></p>`;
        })
        .join('');
      const totalReserva = canchaPrice + group.itemsTotal;
      const cambio =
        group.totalMonto > totalReserva ? group.totalMonto - totalReserva : 0;
      bodyHtml = `
        <h3>Turno de Cancha</h3>
        <p><b>Cancha:</b> ${court}</p>
        <p><b>Horario:</b> ${hour}</p>
        <p><b>Cliente:</b> ${client}</p>
        <p><b>Precio cancha:</b> ${cur(canchaPrice)}</p>
        ${itemsHtml}
        <h3>Cobros</h3>
        ${payLines}
        <p class="cambio">Cambio: ${cur(cambio)}</p>
        <p class="total">TOTAL: ${cur(group.totalMonto)}</p>`;
    } else {
      const method =
        group.totalCash > 0 && group.totalTransfer > 0
          ? 'Efectivo + Transf.'
          : group.totalCash > 0
            ? 'Efectivo'
            : 'Transferencia';
      const saleBase = group.saleTotal ?? group.itemsTotal;
      const cambioSale = group.totalMonto > saleBase ? group.totalMonto - saleBase : 0;
      bodyHtml = `
        <h3>Venta de Productos</h3>
        <p><b>Empleado:</b> ${group.userName}</p>
        ${group.customerName ? `<p><b>Cliente:</b> ${group.customerName}</p>` : ''}
        <p><b>Hora:</b> ${group.firstHora}hs</p>
        ${itemsHtml}
        <p><b>Método de pago:</b> ${method}</p>
        <p class="cambio">Cambio: ${cur(cambioSale)}</p>
        <p class="total">TOTAL: ${cur(group.totalMonto)}</p>`;
    }

    const TICKET_ID = '__ticket-comprobante__';
    const STYLE_ID  = '__ticket-comprobante-style__';

    const container = document.createElement('div');
    container.id = TICKET_ID;
    container.innerHTML = `
      <h2>Comprobante</h2>
      <p class="sub">${now}</p>
      <hr>
      ${bodyHtml}
      <div class="footer">La Caldera Padel &mdash; Comprobante interno</div>
    `;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TICKET_ID} { display: none; }
      @media print {
        body * { visibility: hidden !important; }
        #${TICKET_ID}, #${TICKET_ID} * { visibility: visible !important; }
        #${TICKET_ID} {
          display: block !important;
          position: fixed; top: 0; left: 0; width: 100%;
          background: white; padding: 8mm; box-sizing: border-box;
          font-family: Arial, sans-serif; font-size: 13px; color: #111;
        }
        #${TICKET_ID} h2   { text-align:center; font-size:15px; margin:0 0 2px; }
        #${TICKET_ID} .sub { text-align:center; font-size:11px; color:#777; margin-bottom:10px; }
        #${TICKET_ID} hr   { border:none; border-top:1px dashed #aaa; margin:8px 0; }
        #${TICKET_ID} h3   { font-size:12px; font-weight:700; margin:10px 0 3px; border-bottom:1px solid #ddd; padding-bottom:2px; }
        #${TICKET_ID} p    { margin:2px 0; font-size:13px; }
        #${TICKET_ID} table { width:100%; border-collapse:collapse; margin:4px 0; }
        #${TICKET_ID} th,
        #${TICKET_ID} td   { font-size:12px; padding:3px 2px; text-align:left; }
        #${TICKET_ID} .total  { font-size:16px; font-weight:700; margin-top:10px; }
        #${TICKET_ID} .cambio { font-size:12px; font-weight:700; margin:12px 0 3px; border-bottom:1px solid #ddd; padding-bottom:2px; }
        #${TICKET_ID} .footer { text-align:center; font-size:10px; color:#888; margin-top:14px; }
        /* TODO: descomentar y ajustar ANCHO y ALTO segun tamano del papel (ej: 80mm 150mm) */
        /* @page { size: ANCHOmm ALTOmm; margin: 4mm; } */
        @page { margin: 8mm; }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);

    window.addEventListener('afterprint', () => {
      container.remove();
      style.remove();
    }, { once: true });

    window.print();
  }

  /** Abre la comanda de consumo de una venta de tipo SALE. */
  openTicket(referenceId: string): void {
    this.ticketSaleId = referenceId;
  }

  /** Cierra la comanda de consumo. */
  closeTicket(): void {
    this.ticketSaleId = null;
  }

  /**
   * Muestra una alerta cuando la sesión activa pertenece a una jornada anterior.
   * - Sin movimientos → ofrece cerrarla automáticamente con $0.
   * - Con movimientos → advierte que el empleado debe hacer el Cierre Z manualmente.
   */
  private checkStaleSession(): void {
    const [y, m, d] = (this.sessionDate ?? '').split('-').map(Number);
    const fecha =
      this.sessionDate && y
        ? new Date(y, m - 1, d).toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        : 'un día anterior';

    if (this.movimientos.length === 0) {
      Swal.fire({
        title: 'Caja de jornada anterior abierta',
        html:
          `La caja fue abierta el <strong>${fecha}</strong> y no registró movimientos.<br>` +
          `¿Deseás cerrarla automáticamente para iniciar la jornada de hoy?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrarla',
        cancelButtonText: 'No por ahora',
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#6b7280',
      }).then((result) => {
        if (result.isConfirmed) {
          this.autoCloseStaleSession();
        }
      });
    } else {
      Swal.fire({
        title: 'Jornada anterior sin cerrar',
        html:
          `La caja activa corresponde al <strong>${fecha}</strong> y tiene <strong>${this.movimientos.length}</strong> movimiento(s) registrado(s).<br><br>` +
          `Por favor, realizá el <strong>Cierre Z</strong> de esa jornada antes de comenzar las operaciones de hoy.`,
        icon: 'warning',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#d97706',
      });
    }
  }

  /**
   * Cierra automáticamente la sesión atrasada con $0 contado (jornada sin movimientos).
   * Tras el cierre recarga la vista para mostrar la pantalla de Apertura.
   */
  private autoCloseStaleSession(): void {
    this.isLoading = true;
    this.cashService
      .close({
        efectivoContado: 0,
        notas: 'Cierre automático — jornada sin movimientos',
      })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.toast.success(
            'Jornada cerrada',
            'La jornada anterior fue cerrada automáticamente. Podés abrir la jornada de hoy.',
          );
          this.isSessionOpen = null;
          this.loadCurrentSession();
        },
        error: () => {
          this.toast.error(
            'Error al cerrar',
            'No se pudo cerrar la jornada anterior. Intente el Cierre Z manualmente.',
          );
        },
      });
  }

  /**
   * Genera y descarga automáticamente el Excel de Cierre Z.
   * Hoja 1 "Resumen": datos financieros de la jornada.
   * Hoja 2 "Movimientos": detalle de cada transacción.
   */
  private generateZCloseExcel(
    session: {
      sessionDate: string | null;
      openedAt: string | null;
      closedAt: string;
      userName: string;
      efectivoEsperado: number;
      transferenciaTotal: number;
      totalSistema: number;
      efectivoContado: number;
      diferencia: number;
      notas: string;
    },
    movimientos: CashMovimiento[],
  ): void {
    const fmt = (n: number) =>
      n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const fmtDate = (iso: string | null) => {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const estadoDiferencia =
      session.diferencia === 0
        ? 'Cuadra ✓'
        : session.diferencia > 0
          ? `Sobrante ($${fmt(Math.abs(session.diferencia))})`
          : `Faltante ($${fmt(Math.abs(session.diferencia))})`;

    const resumenData: (string | number)[][] = [
      ['CIERRE DE CAJA Z — INFORME DE JORNADA'],
      [],
      ['DATOS DE LA SESIÓN', ''],
      ['Jornada (fecha apertura)', session.sessionDate ?? '—'],
      ['Apertura', fmtDate(session.openedAt)],
      ['Cierre', fmtDate(session.closedAt)],
      ['Empleado responsable', session.userName],
      [],
      ['RESUMEN FINANCIERO', ''],
      ['Efectivo esperado (sistema)', fmt(session.efectivoEsperado)],
      ['Transferencias', fmt(session.transferenciaTotal)],
      ['Total sistema', fmt(session.totalSistema)],
      [],
      ['ARQUEO FÍSICO', ''],
      ['Efectivo real contado', fmt(session.efectivoContado)],
      ['Diferencia', fmt(session.diferencia)],
      ['Estado', estadoDiferencia],
      [],
      ['OBSERVACIONES', ''],
      ['Notas de cierre', session.notas || 'Sin observaciones'],
    ];

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);

    wsResumen['!cols'] = [{ wch: 32 }, { wch: 28 }];

    const porEmpleado = new Map<
      string,
      {
        operaciones: number;
        totalEfectivo: number;
        totalTransfer: number;
      }
    >();

    for (const m of movimientos) {
      const key = m.userName;
      const acc = porEmpleado.get(key) ?? {
        operaciones: 0,
        totalEfectivo: 0,
        totalTransfer: 0,
      };
      acc.operaciones++;
      acc.totalEfectivo += m.amountCash;
      acc.totalTransfer += m.amountTransfer;
      porEmpleado.set(key, acc);
    }

    const rendicionData = [...porEmpleado.entries()].map(([nombre, acc]) => ({
      Empleado: nombre,
      Operaciones: acc.operaciones,
      'Total Efectivo ($)': fmt(acc.totalEfectivo),
      'Total Transf. ($)': fmt(acc.totalTransfer),
      'Total Recaudado ($)': fmt(acc.totalEfectivo + acc.totalTransfer),
    }));

    const wsRendicion =
      rendicionData.length > 0
        ? XLSX.utils.json_to_sheet(rendicionData)
        : XLSX.utils.aoa_to_sheet([
            [
              'Empleado',
              'Operaciones',
              'Total Efectivo ($)',
              'Total Transf. ($)',
              'Total Recaudado ($)',
            ],
            ['Sin movimientos registrados', '', '', '', ''],
          ]);

    wsRendicion['!cols'] = [
      { wch: 26 },
      { wch: 13 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
    ];

    const movimientosData = movimientos.map((m) => ({
      Hora: m.hora,
      Empleado: m.userName,
      Descripción: m.concepto,
      'Tipo de pago': m.tipo,
      Cliente: m.customerName ?? '—',
      'Monto ($)': m.monto,
    }));

    const wsMovimientos =
      movimientosData.length > 0
        ? XLSX.utils.json_to_sheet(movimientosData)
        : XLSX.utils.aoa_to_sheet([
            [
              'Hora',
              'Empleado',
              'Descripción',
              'Tipo de pago',
              'Cliente',
              'Monto ($)',
            ],
            ['Sin movimientos registrados', '', '', '', '', ''],
          ]);

    wsMovimientos['!cols'] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 38 },
      { wch: 16 },
      { wch: 22 },
      { wch: 12 },
    ];

    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
      XLSX.utils.book_append_sheet(wb, wsRendicion, 'Rendición por Empleado');
      XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos');

      const safeName = session.userName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');

      const fecha =
        session.sessionDate ?? new Date().toLocaleDateString('en-CA');
      const fileName = `Cierre_Caja_Z_${fecha}_${safeName}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch {
      this.toast.error(
        'Falla de Exportación',
        'Error al generar o descargar el archivo Excel. Intente nuevamente.',
      );
    }
  }

  /**
   * Descarga el Excel de Cierre X del turno indicado.
   * Llama al backend y dispara la descarga en el navegador con createObjectURL.
   */
  exportTurnoX(sessionId: string, cajeroName: string): void {
    if (this.exportingSessionId === sessionId) return;
    this.exportingSessionId = sessionId;
    this.cashService
      .exportSession(sessionId)
      .pipe(finalize(() => (this.exportingSessionId = null)))
      .subscribe({
        next: (blob) => {
          const safeName = cajeroName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '');
          this.downloadBlob(
            blob,
            `Cierre_Turno_X_${this.historialDate}_${safeName}.xlsx`,
          );
        },
        error: () =>
          this.toast.error(
            'Error de exportación',
            'No se pudo generar el Excel del turno.',
          ),
      });
  }

  /**
   * Descarga el Excel consolidado de la jornada seleccionada en el historial.
   */
  exportJornadaZ(): void {
    if (!this.historialDate || this.exportingDaily) return;
    this.exportingDaily = true;
    this.cashService
      .exportDaily(this.historialDate)
      .pipe(finalize(() => (this.exportingDaily = false)))
      .subscribe({
        next: (blob) =>
          this.downloadBlob(
            blob,
            `Cierre_Jornada_Z_${this.historialDate}.xlsx`,
          ),
        error: () =>
          this.toast.error(
            'Error de exportación',
            'No se pudo generar el Excel de la jornada.',
          ),
      });
  }

  /**
   * Dispara la descarga de un Blob en el navegador sin abrir nueva pestaña.
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Navega al día anterior (offset = -1) o siguiente (offset = +1)
   * y recarga el consolidado. No permite avanzar más allá de hoy.
   */
  changeDay(offset: number): void {
    const [y, m, d] = this.historialDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + offset);
    const nextStr = this.toISODate(next);
    if (nextStr > this.maxDate) return;
    this.historialDate = nextStr;
    this.loadDailySummary();
  }

  /** Carga el consolidado del día seleccionado en el historial admin. */
  loadDailySummary(): void {
    if (!this.historialDate) return;
    this.historialLoading = true;
    this.dailySummary = null;
    this.cashService
      .getDailySummary(this.historialDate)
      .pipe(finalize(() => (this.historialLoading = false)))
      .subscribe({
        next: (res) => (this.dailySummary = res),
        error: (err) => {
          if (err.status === 403) {
            this.toast.error(
              'Sin permisos',
              'Solo los administradores pueden ver el historial diario.',
            );
          } else {
            this.toast.error(
              'Error',
              'No se pudo cargar el consolidado. Intente nuevamente.',
            );
          }
        },
      });
  }

  /** Etiqueta legible para la diferencia de un turno. */
  diferenciaShiftLabel(shift: DailySummaryShift): string {
    if (shift.difference === null) return '—';
    if (shift.difference === 0) return '✓ Cuadra';
    const sign = shift.difference > 0 ? '+' : '';
    return `${sign}$${this.fmt(shift.difference)}`;
  }

  /** Clase CSS de color para la diferencia de un turno. */
  diferenciaShiftClass(shift: DailySummaryShift): string {
    if (shift.difference === null || shift.difference === 0)
      return 'text-accent';
    return shift.difference > 0 ? 'text-blue-600' : 'text-destructive';
  }

  /** Formatea un ISO timestamp como HH:MM. */
  fmtHora(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /** Formatea YYYY-MM-DD como día legible. */
  fmtDateLabel(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /** Expone Math.abs al template. */
  readonly Math = Math;

  /** Convierte un Date a YYYY-MM-DD sin depender del locale ni de UTC. */
  private toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }
}
