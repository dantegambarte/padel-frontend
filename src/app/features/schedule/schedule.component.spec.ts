import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NgZone } from '@angular/core';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';
import { ScheduleComponent } from './schedule.component';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { CourtsService } from '../../core/services/courts.service';
import { BookingsService } from '../../core/services/bookings.service';
import { ProductsService } from '../../core/services/products.service';
import { ToastService } from '../../core/services/toast.service';
import { NotificationService } from '../../core/services/notification.service';
import { FixedBookingsService } from '../../core/services/fixed-bookings.service';
import { TeachersService } from '../../core/services/teachers.service';
import { CashService } from '../../core/services/cash.service';
import { DraftService } from '../../core/services/draft.service';
import { CalculatorService } from '../../core/services/calculator.service';
import { PricingShiftsService } from '../../core/services/pricing-shifts.service';
import { HolidayService } from '../../core/services/holiday.service';
import { BookingResponse } from '../../core/models/booking.model';
import { Court } from '../../core/models/court.model';
import { Product } from '../../core/models/product.model';
import { PricingShift } from '../../core/models/pricing-shift.model';

describe('ScheduleComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let courtsServiceSpy: jasmine.SpyObj<CourtsService>;
  let bookingsServiceSpy: jasmine.SpyObj<BookingsService>;
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let fixedBookingsServiceSpy: jasmine.SpyObj<FixedBookingsService>;
  let teachersServiceSpy: jasmine.SpyObj<TeachersService>;
  let cashServiceSpy: jasmine.SpyObj<CashService>;
  let draftServiceSpy: jasmine.SpyObj<DraftService>;
  let pricingShiftsServiceSpy: jasmine.SpyObj<PricingShiftsService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let queryParams: Subject<any>;
  let bookingUpdatedSubject: Subject<BookingResponse>;

  const court: Court = { id: 'c1', name: 'Cancha 1', description: '', isActive: true };
  const product: Product = {
    id: 'p1',
    name: 'Gatorade',
    costPrice: 500,
    salePrice: 800,
    stock: 10,
    minStock: 2,
    isFeatured: true,
    isActive: true,
  };
  const shift: PricingShift = {
    id: 's1',
    name: 'Turno Tarde',
    startTime: '00:00',
    endTime: '23:59',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    price30min: 1500,
    price60min: 3000,
    price90min: 4500,
    price120min: 6000,
    teacherPricePerHour: 2500,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  function makeBooking(overrides: Partial<BookingResponse> = {}): BookingResponse {
    return {
      id: 'b1',
      court,
      courtId: 'c1',
      date: '2026-01-05',
      hour: '10:00',
      clientName: 'Juan',
      status: 'booked',
      priceType: 'standard',
      appliedShiftName: null,
      priceAmount: 3000,
      durationMinutes: 60,
      items: [],
      payment: null,
      createdAt: '',
      fixedBookingId: null,
      fixedBooking: null,
      isConfirmed: false,
      expectedDepositAmount: null,
      playerCount: null,
      teacherRateSnapshot: null,
      ...overrides,
    };
  }

  function setup() {
    queryParams = new Subject();
    bookingUpdatedSubject = new Subject<BookingResponse>();

    authServiceSpy = jasmine.createSpyObj('AuthService', [], { isAdmin: true });
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getAll']);
    courtsServiceSpy = jasmine.createSpyObj('CourtsService', ['findAll']);
    bookingsServiceSpy = jasmine.createSpyObj('BookingsService', [
      'findByDate',
      'create',
      'update',
      'cancel',
      'move',
      'duplicate',
      'getTicketSummary',
    ], { bookingUpdated$: bookingUpdatedSubject.asObservable() });
    productsServiceSpy = jasmine.createSpyObj('ProductsService', [
      'findAll',
      'clearCache',
      'clearLowStockCache',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error', 'info']);
    notificationServiceSpy = jasmine.createSpyObj('NotificationService', [
      'add',
      'removeByEntityId',
    ]);
    fixedBookingsServiceSpy = jasmine.createSpyObj('FixedBookingsService', ['create']);
    teachersServiceSpy = jasmine.createSpyObj('TeachersService', ['findAll']);
    cashServiceSpy = jasmine.createSpyObj('CashService', ['getCurrent']);
    draftServiceSpy = jasmine.createSpyObj('DraftService', [
      'saveDraft',
      'getDraft',
      'clearDraft',
      'hasDraft',
    ]);
    pricingShiftsServiceSpy = jasmine.createSpyObj('PricingShiftsService', ['getActive']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    courtsServiceSpy.findAll.and.returnValue(of([court]));
    productsServiceSpy.findAll.and.returnValue(of([product]));
    configServiceSpy.getAll.and.returnValue(
      of([
        { key: 'hora_apertura', value: '09:00' },
        { key: 'hora_cierre', value: '23:00' },
      ]),
    );
    teachersServiceSpy.findAll.and.returnValue(of([]));
    pricingShiftsServiceSpy.getActive.and.returnValue(of([shift]));
    bookingsServiceSpy.findByDate.and.returnValue(of([]));
    cashServiceSpy.getCurrent.and.returnValue(
      of({ isClosed: false, noSession: false } as any),
    );
    draftServiceSpy.hasDraft.and.returnValue(false);

    TestBed.configureTestingModule({
    imports: [ScheduleComponent],
    providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: CourtsService, useValue: courtsServiceSpy },
        { provide: BookingsService, useValue: bookingsServiceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: CalculatorService, useValue: jasmine.createSpyObj('CalculatorService', ['open']) },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams.asObservable() } },
        { provide: FixedBookingsService, useValue: fixedBookingsServiceSpy },
        { provide: TeachersService, useValue: teachersServiceSpy },
        { provide: CashService, useValue: cashServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PricingShiftsService, useValue: pricingShiftsServiceSpy },
        { provide: DraftService, useValue: draftServiceSpy },
        { provide: HolidayService, useValue: { isHoliday: false } },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('loads courts, products, schedule config and pricing shifts on init', () => {
    setup();
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.courts()).toEqual([court]);
    expect(component.allProducts()).toEqual([product]);
    expect(component.horarioApertura).toBe('09:00');
    expect(component.horarioCierre()).toBe('23:00');
    expect(component.pricingShifts()).toEqual([shift]);
    expect(component.isLoading()).toBe(false);
  });

  it('shows a connection error when the initial parallel load fails', () => {
    setup();
    courtsServiceSpy.findAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.loadError()).toContain('No se pudo conectar');
  });

  it('loadBookings() populates the bookingMap and excludes cancelled bookings', () => {
    setup();
    bookingsServiceSpy.findByDate.and.returnValue(
      of([makeBooking({ id: 'b1' }), makeBooking({ id: 'b2', status: 'cancelled', hour: '11:00' })]),
    );
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.getBooking('c1', '10:00')?.id).toBe('b1');
    expect(fixture.componentInstance.getBooking('c1', '11:00')).toBeUndefined();
  });

  it('checkCashStatus reflects an open, active cash session', () => {
    setup();
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isCashRegisterOpen()).toBe(true);
  });

  it('onSlotClick() opens the create dialog for a free slot and the detail dialog for an occupied one', () => {
    setup();
    bookingsServiceSpy.findByDate.and.returnValue(of([makeBooking()]));
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.onSlotClick(court, '14:00');
    expect(component.dialogMode()).toBe('create');
    expect(component.isDialogOpen()).toBe(true);

    component.closeDialog();
    component.onSlotClick(court, '10:00');
    expect(component.dialogMode()).toBe('detail');
    expect(component.selectedBooking()?.id).toBe('b1');
  });

  it('onSlotClick() is a no-op while a drag is in progress', () => {
    setup();
    const fixture = TestBed.createComponent(ScheduleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.onDragStarted();

    component.onSlotClick(court, '14:00');

    expect(component.isDialogOpen()).toBe(false);
  });

  describe('pricing getters', () => {
    it('courtPrice resolves from the active pricing shift for the standard duration', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.durationMinutes.set(60);
      expect(component.courtPrice).toBe(3000);
    });

    it('courtPrice uses the teacher rate when isTeacherBooking is true', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.isTeacherBooking = true;
      component.durationMinutes.set(60);
      expect(component.courtPrice).toBe(2500);
    });

    it('isTariffMissing is true when no shift covers the selected slot', () => {
      setup();
      pricingShiftsServiceSpy.getActive.and.returnValue(of([]));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      expect(component.isTariffMissing).toBe(true);
    });

    it('exceedsClosingTime is true when the slot + duration overflows the closing hour', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '22:30');
      component.durationMinutes.set(90);
      expect(component.exceedsClosingTime).toBe(true);
    });

    it('totalReservation / outstandingBalance / balanceText reflect cart + payments', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.addToCart(product);

      expect(component.totalReservation).toBe(3800); // 3000 court + 800 item
      expect(component.outstandingBalance).toBe(3800);
      expect(component.balanceText).toContain('Falta Pagar');

      component.cashPayment = 3800;
      expect(component.outstandingBalance).toBe(0);
      expect(component.balanceText).toBe('✓ Pago Completo');

      component.cashPayment = 4000;
      expect(component.balanceText).toContain('Vuelto');
    });
  });

  describe('cart management', () => {
    it('addToCart() adds a new item once and increments quantity on repeated calls', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.addToCart(product);
      component.addToCart(product);

      expect(component.cart().length).toBe(1);
      expect(component.cart()[0].quantity).toBe(2);
    });

    it('updateQty() removes the item when quantity drops to 0', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToCart(product);

      component.updateQty(product.id, 0);

      expect(component.cart().length).toBe(0);
    });

    it('removeFromCart() removes the matching product', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.addToCart(product);
      component.removeFromCart(product.id);
      expect(component.cart().length).toBe(0);
    });
  });

  describe('saveBooking()', () => {
    it('requires a client name', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      fixture.componentInstance.onSlotClick(court, '10:00');

      fixture.componentInstance.saveBooking();

      expect(toastServiceSpy.error).toHaveBeenCalled();
      expect(bookingsServiceSpy.create).not.toHaveBeenCalled();
    });

    it('blocks cash payments when the register is closed', () => {
      setup();
      cashServiceSpy.getCurrent.and.returnValue(of({ isClosed: true, noSession: false } as any));
      spyOn(Swal, 'fire').and.returnValue(Promise.resolve({} as any));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.clientName = 'Juan';
      component.cashPayment = 3000;

      component.saveBooking();

      expect(Swal.fire).toHaveBeenCalled();
      expect(bookingsServiceSpy.create).not.toHaveBeenCalled();
    });

    it('creates the booking and closes the dialog on success', () => {
      setup();
      bookingsServiceSpy.create.and.returnValue(of(makeBooking()));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.clientName = 'Juan';

      component.saveBooking();

      expect(bookingsServiceSpy.create).toHaveBeenCalled();
      expect(component.isDialogOpen()).toBe(false);
      expect(toastServiceSpy.success).toHaveBeenCalled();
    });

    it('reloads the grid and warns the user on a 409 slot conflict', () => {
      setup();
      bookingsServiceSpy.create.and.returnValue(throwError(() => ({ status: 409 })));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      bookingsServiceSpy.findByDate.calls.reset();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.clientName = 'Juan';

      component.saveBooking();

      expect(toastServiceSpy.error).toHaveBeenCalledWith('Turno ocupado', jasmine.any(String));
      expect(bookingsServiceSpy.findByDate).toHaveBeenCalled();
    });

    it('creates a fixed booking (recurring) when isFixedBookingMode is on', () => {
      setup();
      fixedBookingsServiceSpy.create.and.returnValue(of({} as any));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.clientName = 'Juan';
      component.isFixedBookingMode = true;
      component.phoneNumber = '1122334455';

      component.saveBooking();

      expect(fixedBookingsServiceSpy.create).toHaveBeenCalled();
      expect(bookingsServiceSpy.create).not.toHaveBeenCalled();
    });

    it('requires a phone number for fixed bookings', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onSlotClick(court, '10:00');
      component.clientName = 'Juan';
      component.isFixedBookingMode = true;
      component.phoneNumber = '';

      component.saveBooking();

      expect(toastServiceSpy.error).toHaveBeenCalledWith('Teléfono requerido', jasmine.any(String));
      expect(fixedBookingsServiceSpy.create).not.toHaveBeenCalled();
    });
  });

  describe('status transitions', () => {
    it('onStartPlaying() moves the booking to "playing" for a regular slot', () => {
      setup();
      const booking = makeBooking({ status: 'booked' });
      bookingsServiceSpy.update.and.returnValue(of({ ...booking, status: 'playing' }));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onStartPlaying(booking);

      expect(bookingsServiceSpy.update).toHaveBeenCalledWith('b1', { status: 'playing' });
      expect(toastServiceSpy.success).toHaveBeenCalledWith('Partido iniciado', jasmine.any(String));
    });

    it('onStartPlaying() closes the dialog immediately for professor (class) bookings', () => {
      setup();
      const booking = makeBooking({ status: 'booked', priceType: 'professor' });
      bookingsServiceSpy.update.and.returnValue(of({ ...booking, status: 'playing' }));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.isDialogOpen.set(true);

      component.onStartPlaying(booking);

      expect(toastServiceSpy.success).toHaveBeenCalledWith('Clase registrada', jasmine.any(String));
      expect(component.isDialogOpen()).toBe(false);
    });

    it('onFinishPlaying() completes the booking with the paid amounts', () => {
      setup();
      const booking = makeBooking({ status: 'playing' });
      bookingsServiceSpy.update.and.returnValue(of({ ...booking, status: 'completed' }));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onFinishPlaying(booking);

      expect(bookingsServiceSpy.update).toHaveBeenCalledWith(
        'b1',
        jasmine.objectContaining({ status: 'completed' }),
      );
      expect(productsServiceSpy.clearCache).toHaveBeenCalled();
    });

    it('onCancelBooking() blocks non-admin users', () => {
      setup();
      Object.defineProperty(authServiceSpy, 'isAdmin', { get: () => false });
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onCancelBooking(makeBooking());

      expect(toastServiceSpy.error).toHaveBeenCalledWith('Sin permisos', jasmine.any(String));
      expect(bookingsServiceSpy.cancel).not.toHaveBeenCalled();
    });

    it('onCancelBooking() cancels and shows a confirmation toast for an admin', () => {
      setup();
      bookingsServiceSpy.cancel.and.returnValue(of(undefined));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onCancelBooking(makeBooking());

      expect(bookingsServiceSpy.cancel).toHaveBeenCalledWith('b1');
      expect(toastServiceSpy.info).toHaveBeenCalled();
    });
  });

  describe('drag & drop reschedule', () => {
    it('onBookingDrop() ignores a drop back into the same container', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const sameContainer = {} as any;

      fixture.componentInstance.onBookingDrop({
        previousContainer: sameContainer,
        container: sameContainer,
        item: { data: makeBooking() },
      } as any);

      expect(fixture.componentInstance.rescheduleDialogOpen()).toBe(false);
    });

    it('onBookingDrop() ignores completed bookings', fakeAsync(() => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onBookingDrop({
        previousContainer: {} as any,
        container: { data: { courtId: 'c1', hour: '11:00' } } as any,
        item: { data: makeBooking({ status: 'completed' }) },
      } as any);
      tick(4000);

      expect(fixture.componentInstance.rescheduleDialogOpen()).toBe(false);
      discardPeriodicTasks();
    }));

    it('onBookingDrop() opens the reschedule dialog for a valid cross-container drop', fakeAsync(() => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.onBookingDrop({
        previousContainer: {} as any,
        container: { data: { courtId: 'c2', hour: '11:00' } } as any,
        item: { data: makeBooking() },
      } as any);
      tick(4000);

      expect(fixture.componentInstance.rescheduleDialogOpen()).toBe(true);
      expect(fixture.componentInstance.rescheduleTargetCourtId).toBe('c2');
      discardPeriodicTasks();
    }));

    it('confirmReschedule() requires a complete destination', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      fixture.componentInstance.confirmReschedule('move');

      expect(toastServiceSpy.error).toHaveBeenCalledWith('Datos incompletos', jasmine.any(String));
      expect(bookingsServiceSpy.move).not.toHaveBeenCalled();
    });

    it('confirmReschedule() moves a non-recurring booking directly', fakeAsync(() => {
      setup();
      bookingsServiceSpy.move.and.returnValue(of(makeBooking()));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      bookingsServiceSpy.findByDate.and.returnValue(of([makeBooking()]));
      fixture.componentInstance.onBookingDrop({
        previousContainer: {} as any,
        container: { data: { courtId: 'c1', hour: '12:00' } } as any,
        item: { data: makeBooking() },
      } as any);
      tick(4000);

      fixture.componentInstance.confirmReschedule('move');
      tick(4000);

      expect(bookingsServiceSpy.move).toHaveBeenCalledWith(
        'b1',
        jasmine.objectContaining({ courtId: 'c1', hour: '12:00' }),
      );
      expect(toastServiceSpy.success).toHaveBeenCalledWith('Turno movido', jasmine.any(String));
      discardPeriodicTasks();
    }));

    it('confirmReschedule() shows a 409 slot-conflict error', fakeAsync(() => {
      setup();
      bookingsServiceSpy.move.and.returnValue(throwError(() => ({ status: 409 })));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      fixture.componentInstance.onBookingDrop({
        previousContainer: {} as any,
        container: { data: { courtId: 'c1', hour: '12:00' } } as any,
        item: { data: makeBooking() },
      } as any);
      tick(4000);

      fixture.componentInstance.confirmReschedule('move');

      expect(toastServiceSpy.error).toHaveBeenCalledWith('Slot ocupado', jasmine.any(String));
      discardPeriodicTasks();
    }));

    it('confirmReschedule() asks the user for recurring bookings before moving', fakeAsync(() => {
      setup();
      spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false, isDenied: false } as any));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      bookingsServiceSpy.findByDate.and.returnValue(
        of([makeBooking({ fixedBookingId: 'fb1' })]),
      );
      fixture.componentInstance.loadBookings();
      fixture.componentInstance.onBookingDrop({
        previousContainer: {} as any,
        container: { data: { courtId: 'c1', hour: '12:00' } } as any,
        item: { data: makeBooking({ fixedBookingId: 'fb1' }) },
      } as any);
      tick(4000);

      fixture.componentInstance.confirmReschedule('move');

      expect(Swal.fire).toHaveBeenCalled();
      expect(bookingsServiceSpy.move).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('navigation', () => {
    it('prevDay()/nextDay() shift selectedDate by one day and reload', () => {
      setup();
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.selectedDate = '2026-01-15';

      component.nextDay();
      expect(component.selectedDate).toBe('2026-01-16');

      component.prevDay();
      expect(component.selectedDate).toBe('2026-01-15');
    });

    it('reacts to the "date" and "openBooking" query params', () => {
      setup();
      bookingsServiceSpy.findByDate.and.returnValue(of([makeBooking({ hour: '09:00' })]));
      const fixture = TestBed.createComponent(ScheduleComponent);
      fixture.detectChanges();

      queryParams.next({ date: '2026-02-01', openBooking: 'b1' });

      expect(fixture.componentInstance.selectedDate).toBe('2026-02-01');
    });
  });
});
