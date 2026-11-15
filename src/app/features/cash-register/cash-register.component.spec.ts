import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';
import { CashService, OpenCashDto } from '../../core/services/cash.service';
import { ConfigService } from '../../core/services/config.service';
import { DraftService } from '../../core/services/draft.service';
import { ToastService } from '../../core/services/toast.service';
import { CashRegisterComponent, GroupedMovimiento } from './cash-register.component';
import { DisableScrollDirective } from '../../shared/directives/disable-scroll.directive';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';

@Component({ selector: 'app-ticket-modal', template: '' })
class TicketModalStubComponent {
  readonly saleId = input<string | null>(null);
  readonly closeModal = output<void>();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Respuesta mínima para el path noSession (pantalla de Apertura). */
const NO_SESSION_RESPONSE = {
  noSession: true,
  isBusinessDayClosed: false,
  hasPendingClosures: false,
  sessionId: null,
  isClosed: false,
  efectivoEsperado: 0,
  transferenciaTotal: 0,
  initialBalance: 0,
  cashIncome: 0,
  cashExpenseTotal: 0,
  movimientos: [],
  sessionDate: null,
  openedAt: null,
  openedByName: null,
  cashCounted: null,
  difference: null,
  closedNotes: null,
  staleSession: false,
};

/** Error 409 con body DAY_ALREADY_CLOSED tal como lo lanza el backend. */
const ERROR_DAY_ALREADY_CLOSED = {
  status: 409,
  error: {
    errorCode: 'DAY_ALREADY_CLOSED',
    message: 'La jornada de hoy ya fue cerrada. Indicá cómo querés proceder.',
    date: '2026-06-16',
  },
};

/** Resultado de Swal cuando el usuario descarta el modal (Cancelar). */
const SWAL_DISMISSED = Promise.resolve({
  isConfirmed: false,
  isDenied: false,
  isDismissed: true,
  value: undefined,
} as any);

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('CashRegisterComponent — apertura de caja / manejo de conflicto DAY_ALREADY_CLOSED', () => {
  let component: CashRegisterComponent;
  let fixture: ComponentFixture<CashRegisterComponent>;
  let cashService: jasmine.SpyObj<CashService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    cashService = jasmine.createSpyObj<CashService>('CashService', [
      'getCurrent',
      'getLastClosedSuggestion',
      'open',
      'close',
      'checkPendings',
      'closeDay',
      'getDailySummary',
      'exportSession',
      'exportDaily',
    ]);

    // Defaults seguros para que ngOnInit no explote
    cashService.getCurrent.and.returnValue(of(NO_SESSION_RESPONSE as any));
    cashService.getLastClosedSuggestion.and.returnValue(of({ cashCounted: null }));

    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
      'info',
    ]);

    TestBed.overrideComponent(CashRegisterComponent, {
      set: {
        imports: [ReactiveFormsModule, DisableScrollDirective, FormsModule, NgClass, TicketModalStubComponent, ModalScrollLockDirective],
      },
    });
    await TestBed.configureTestingModule({
    imports: [CashRegisterComponent],
    providers: [
        { provide: CashService, useValue: cashService },
        {
            provide: AuthService,
            useValue: {
                isAdmin: true,
                isAdminSignal: signal(true),
                currentUser: { fullName: 'Cajero Test' },
                currentUserSignal: signal({ fullName: 'Cajero Test' }),
            },
        },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        {
            provide: DraftService,
            useValue: {
                hasDraft: jasmine.createSpy('hasDraft').and.returnValue(false),
                getDraft: jasmine.createSpy('getDraft').and.returnValue(null),
                saveDraft: jasmine.createSpy('saveDraft'),
                clearDraft: jasmine.createSpy('clearDraft'),
            },
        },
        {
            provide: ConfigService,
            useValue: { getAll: jasmine.createSpy('getAll').and.returnValue(of([])) },
        },
    ],
}).compileComponents();

    fixture = TestBed.createComponent(CashRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // dispara ngOnInit
  });

  afterEach(() => {
    Swal.close(); // evita que un modal real bloquee el siguiente test
  });

  // ─── Test 1 ────────────────────────────────────────────────────────────────

  it('debe abrir el modal de Swal cuando cashService.open falla con 409 DAY_ALREADY_CLOSED', fakeAsync(() => {
    cashService.open.and.returnValue(throwError(() => ERROR_DAY_ALREADY_CLOSED));

    const swalSpy = spyOn(Swal, 'fire').and.returnValue(SWAL_DISMISSED);

    component.fondoInicial = '5000';
    component.abrirJornada();
    tick();

    expect(swalSpy).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        icon: 'warning',
        title: 'Advertencia',
        showDenyButton: true,
        confirmButtonText: jasmine.stringContaining('Reabrir'),
        denyButtonText: jasmine.stringContaining('mañana'),
      }),
    );
  }));

  // ─── Test 2 ────────────────────────────────────────────────────────────────

  it('debe llamar a cashService.open con conflictAction reopen_today cuando el usuario hace Confirm en el modal', fakeAsync(() => {
    cashService.open.and.returnValues(
      throwError(() => ERROR_DAY_ALREADY_CLOSED),
      of({} as any), // segunda llamada exitosa
    );

    spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: undefined } as any),
    );

    component.fondoInicial = '5000';
    component.abrirJornada();
    tick();

    expect(cashService.open).toHaveBeenCalledTimes(2);

    const secondDto: OpenCashDto = cashService.open.calls.argsFor(1)[0];
    expect(secondDto.conflictAction).toBe('reopen_today');
  }));

  // ─── Test 3 ────────────────────────────────────────────────────────────────

  it('debe llamar a cashService.open con conflictAction force_next_day cuando el usuario hace Deny en el modal', fakeAsync(() => {
    cashService.open.and.returnValues(
      throwError(() => ERROR_DAY_ALREADY_CLOSED),
      of({} as any), // segunda llamada exitosa
    );

    spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({ isConfirmed: false, isDenied: true, isDismissed: false, value: undefined } as any),
    );

    component.fondoInicial = '5000';
    component.abrirJornada();
    tick();

    expect(cashService.open).toHaveBeenCalledTimes(2);

    const secondDto: OpenCashDto = cashService.open.calls.argsFor(1)[0];
    expect(secondDto.conflictAction).toBe('force_next_day');
  }));

  // ─── Test 4 ────────────────────────────────────────────────────────────────

  it('debe resetear isOpening a false en el momento que se muestra el modal de conflicto', fakeAsync(() => {
    cashService.open.and.returnValue(throwError(() => ERROR_DAY_ALREADY_CLOSED));

    let isOpeningCapturado: boolean | undefined;

    spyOn(Swal, 'fire').and.callFake((..._args: any[]) => {
      // Capturamos el estado de isOpening en el instante exacto en que el modal se abre
      isOpeningCapturado = component.isOpening();
      return SWAL_DISMISSED;
    });

    component.fondoInicial = '5000';
    // abrirJornada setea isOpening = true antes de llamar a doOpenCash
    component.abrirJornada();
    tick();

    expect(isOpeningCapturado).toBe(false);
  }));

  // ─── Rendered template ─────────────────────────────────────────────────────

  it('renders the closed-register opening screen when there is no session', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Caja Cerrada');
    expect(el.textContent).not.toContain('Consultando estado de caja...');
  });

  it('renders the loading state while the session status is unknown', () => {
    component.isSessionOpen.set(null);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Consultando estado de caja...');
    expect(el.textContent).not.toContain('Caja Cerrada');
  });

  // ─── Initial fund pre-filled from configuration ─────────────────────────────
  describe('initial fund pre-filled from fondo_caja_base', () => {
    let config$: Subject<{ key: string; value: string }[]>;

    beforeEach(() => {
      config$ = new Subject();
      (TestBed.inject(ConfigService).getAll as jasmine.Spy).and.returnValue(config$);
      component.fondoInicial = '';
      (component as any).loadCurrentSession();
    });

    it('uses fondo_caja_base when the user has not typed anything yet', () => {
      config$.next([{ key: 'fondo_caja_base', value: '25000' }]);
      expect(component.fondoInicial).toBe('25000');
    });

    it('keeps the fund the user typed while the configuration was loading', () => {
      component.fondoInicial = '0';
      config$.next([{ key: 'fondo_caja_base', value: '25000' }]);
      expect(component.fondoInicial).toBe('0');
    });
  });

  // ─── Receipt escapes user-entered names (stored XSS) ────────────────────────
  describe('printTicket', () => {
    const payload = '<img src=x onerror="window.__xss=1">';

    afterEach(() => document.getElementById('__ticket-comprobante__')?.remove());

    function group(overrides: Partial<GroupedMovimiento>): GroupedMovimiento {
      return {
        type: 'SALE', referenceId: 's1', concepto: 'Venta', customerName: null,
        bookingCourtName: null, bookingHour: null, bookingClientName: null,
        bookingPriceAmount: null, saleTotal: 1000,
        items: [{ productName: payload, quantity: 1, unitPrice: 1000, total: 1000 } as any],
        itemsTotal: 1000, totalMonto: 1000, totalCash: 1000, totalTransfer: 0,
        transactions: [], hasMultiplePayments: false, firstHora: '10:00', userName: payload,
        hasCash: true, hasTransfer: false, hasCourt: false, hasCantina: true,
        expenseCategory: null, latestCreatedAt: new Date().toISOString(),
        ...overrides,
      };
    }

    function printAndGetTicket(g: GroupedMovimiento): HTMLElement {
      spyOn(window, 'print');
      component.printTicket(g);
      return document.getElementById('__ticket-comprobante__')!;
    }

    it('renders HTML in sale names as text instead of markup', () => {
      const ticket = printAndGetTicket(group({ customerName: payload }));
      expect(ticket.querySelector('img')).toBeNull();
      expect(ticket.textContent).toContain(payload);
    });

    it('renders HTML in booking court and client names as text', () => {
      const ticket = printAndGetTicket(
        group({ type: 'BOOKING', bookingCourtName: payload, bookingClientName: payload, bookingHour: '20:00' }),
      );
      expect(ticket.querySelector('img')).toBeNull();
      expect(ticket.textContent).toContain(`Cancha: ${payload}`);
      expect(ticket.textContent).toContain(`Cliente: ${payload}`);
    });
  });
});
