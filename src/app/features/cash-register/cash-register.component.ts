import { Component, HostListener, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

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

  efectivoContado = '';
  notas = '';
  isDialogOpen = false;
  isSubmitting = false;

  constructor(
    private cashService: CashService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadCurrentSession();
  }

  get userName(): string {
    return this.authService.currentUser?.fullName ?? 'Usuario';
  }

  get totalEsperado(): number   { return this.efectivoEsperado + this.transferenciaTotal; }
  get efectivoReal(): number    { return parseFloat(this.efectivoContado || '0'); }
  get diferencia(): number      { return this.efectivoReal - this.efectivoEsperado; }
  get absD(): number            { return Math.abs(this.diferencia); }
  get showDiferencia(): boolean { return !!this.efectivoContado && this.efectivoContado !== ''; }

  get diferenciaClass(): string {
    if (this.diferencia === 0) return 'text-accent';
    return this.diferencia > 0 ? 'text-blue-600' : 'text-destructive';
  }

  get diferenciaText(): string {
    if (this.diferencia === 0) return '✓ Cuadra';
    const sign = this.diferencia > 0 ? '+' : '';
    return `${sign}$${this.fmt(this.diferencia)}`;
  }

  get indicatorClass(): string {
    return this.diferencia === 0
      ? 'border border-accent/50 bg-accent/10 text-accent'
      : 'border border-yellow-500/50 bg-yellow-500/10 text-yellow-700';
  }

  get discrepancyLabel(): string {
    return this.diferencia > 0
      ? `Hay un sobrante de $${this.fmt(this.absD)}`
      : `Falta $${this.fmt(this.absD)}`;
  }

  private loadCurrentSession(): void {
    this.isLoading = true;
    this.cashService.getCurrent().pipe(
      finalize(() => (this.isLoading = false)),
    ).subscribe({
      next: (res) => {
        // session: null → no hubo operaciones hoy, mostrar "Abrir Caja"
        if (res.sessionId === null) {
          this.noSesionActiva = true;
          return;
        }
        this.sessionId          = res.sessionId;
        this.isClosed           = res.isClosed;
        this.efectivoEsperado   = res.efectivoEsperado;
        this.transferenciaTotal = res.transferenciaTotal;
        this.movimientos        = res.movimientos;
      },
      error: () => {
        this.toast.error('Error al cargar la caja', 'Intente recargar la página');
      },
    });
  }

  openConfirmDialog(): void {
    if (!this.efectivoContado) {
      this.toast.error('Error', 'Por favor ingrese el efectivo contado');
      return;
    }
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  confirmarCierre(): void {
    this.isSubmitting = true;
    this.cashService.close({
      efectivoContado: this.efectivoReal,
      notas: this.notas || undefined,
    }).pipe(
      finalize(() => (this.isSubmitting = false)),
    ).subscribe({
      next: () => {
        this.isDialogOpen = false;
        this.isClosed = true;

        const detalle = this.diferencia === 0
          ? 'Todo cuadra perfectamente.'
          : `Diferencia: $${this.fmt(this.absD)}`;

        this.toast.success(
          'Caja cerrada exitosamente',
          `Cierre Z realizado por ${this.userName}. ${detalle}`,
        );
      },
      error: (err) => {
        if (err.status === 409) {
          this.toast.error('Caja ya cerrada', 'La sesión de caja ya fue cerrada anteriormente');
          this.isClosed = true;
        } else {
          this.toast.error('Error al cerrar caja', 'Intente nuevamente');
        }
      },
    });
  }

  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }
}
