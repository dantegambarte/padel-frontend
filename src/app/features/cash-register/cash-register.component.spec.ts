import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';
import { CashService, OpenCashDto } from '../../core/services/cash.service';
import { ConfigService } from '../../core/services/config.service';
import { DraftService } from '../../core/services/draft.service';
import { ToastService } from '../../core/services/toast.service';
import { CashRegisterComponent } from './cash-register.component';

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
    schemas: [NO_ERRORS_SCHEMA],
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
});
