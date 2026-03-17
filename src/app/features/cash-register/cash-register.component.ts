import { Component, HostListener, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { CashService, CashMovimiento } from '../../core/services/cash.service';

@Component({
  selector: 'app-cash-register',
  templateUrl: './cash-register.component.html',
})
export class CashRegisterComponent implements OnInit {
  isLoading = true;
  sessionId: string | null = null;
  isClosed = false;
  efectivoEsperado = 0;
  transferenciaTotal = 0;
  movimientos: CashMovimiento[] = [];
  noSesionActiva = false;
  sessionDate: string | null = null;
  openedAt: string | null = null;

  efectivoContado = '';
  notas = '';
  isDialogOpen = false;
  isSubmitting = false;

  ticketSaleId: string | null = null;

  constructor(
    private cashService: CashService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadCurrentSession();
  }

  /** Devuelve el nombre completo del usuario autenticado. */
  get userName(): string {
    return this.authService.currentUser?.fullName ?? 'Usuario';
  }

  /**
   * Etiqueta de la jornada. Si la sesión fue abierta en un día diferente al calendario
   * actual (escenario de madrugada), muestra "Jornada del [fecha apertura]".
   * En el caso normal muestra "Jornada de hoy".
   */
  get jornadaLabel(): string {
    if (!this.sessionDate) return 'Jornada de hoy';
    const [year, month, day] = this.sessionDate.split('-').map(Number);
    const sessionDay = new Date(year, month - 1, day);
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (this.sessionDate !== todayStr) {
      return `Jornada del ${sessionDay.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}`;
    }
    return 'Jornada de hoy';
  }

  /** Suma de efectivo esperado y total de transferencias. */
  get totalEsperado(): number {
    return this.efectivoEsperado + this.transferenciaTotal;
  }

  /** Convierte el string del input de efectivo contado a número. */
  get efectivoReal(): number {
    return parseFloat(this.efectivoContado || '0');
  }

  /** Diferencia entre el efectivo real contado y el esperado por el sistema. */
  get diferencia(): number {
    return this.efectivoReal - this.efectivoEsperado;
  }

  /** Valor absoluto de la diferencia. */
  get absD(): number {
    return Math.abs(this.diferencia);
  }

  /** Indica si se debe mostrar el resumen de diferencia en la UI. */
  get showDiferencia(): boolean {
    return !!this.efectivoContado && this.efectivoContado !== '';
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
   * Si no hay sesión activa hoy, activa el estado `noSesionActiva`.
   */
  private loadCurrentSession(): void {
    this.isLoading = true;
    this.cashService
      .getCurrent()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res) => {
          if (res.sessionId === null) {
            this.noSesionActiva = true;
            return;
          }
          this.sessionId = res.sessionId;
          this.isClosed = res.isClosed;
          this.efectivoEsperado = res.efectivoEsperado;
          this.transferenciaTotal = res.transferenciaTotal;
          this.movimientos = res.movimientos;
          this.sessionDate = res.sessionDate;
          this.openedAt = res.openedAt;
        },
        error: () => {
          this.toast.error(
            'Error al cargar la caja',
            'Intente recargar la página',
          );
        },
      });
  }

  /**
   * Abre el diálogo de confirmación de cierre.
   * Requiere que el efectivo contado esté ingresado.
   */
  openConfirmDialog(): void {
    if (!this.efectivoContado) {
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

  /** Abre la comanda de consumo de una venta de tipo SALE. */
  openTicket(referenceId: string): void {
    this.ticketSaleId = referenceId;
  }

  /** Cierra la comanda de consumo. */
  closeTicket(): void {
    this.ticketSaleId = null;
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

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    XLSX.utils.book_append_sheet(wb, wsRendicion, 'Rendición por Empleado');
    XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos');

    const safeName = session.userName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

    const fecha = session.sessionDate ?? new Date().toLocaleDateString('en-CA');
    const fileName = `Cierre_Caja_Z_${fecha}_${safeName}.xlsx`;

    XLSX.writeFile(wb, fileName);
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }
}
