import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { FixedBookingsComponent } from './fixed-bookings.component';
import {
  FixedBookingsService,
  FixedBooking,
} from '../../core/services/fixed-bookings.service';
import { CourtsService } from '../../core/services/courts.service';
import { ToastService } from '../../core/services/toast.service';
import { TeachersService } from '../../core/services/teachers.service';
import { Court } from '../../core/models/court.model';
import { Teacher } from '../../core/models/teacher.model';

describe('FixedBookingsComponent', () => {
  let fixedSvcSpy: jasmine.SpyObj<FixedBookingsService>;
  let courtsSvcSpy: jasmine.SpyObj<CourtsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let teachersSvcSpy: jasmine.SpyObj<TeachersService>;
  let courtsSubject: BehaviorSubject<Court[]>;

  const court: Court = { id: 'c1', name: 'Cancha 1', description: '', isActive: true };
  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: '1122334455',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  const bookingA: FixedBooking = {
    id: 'fb1',
    clientName: 'María',
    phoneNumber: '1100000000',
    dayOfWeek: 1,
    hour: '10:00',
    durationMinutes: 60,
    courtId: 'c1',
    court: { id: 'c1', name: 'Cancha 1', isActive: true },
    isActive: true,
    startDate: '2026-01-05',
    notes: null,
    teacherId: null,
    teacher: null,
    recurringDepositAmount: null,
    createdAt: '',
    updatedAt: '',
  };

  function setup() {
    courtsSubject = new BehaviorSubject<Court[]>([court]);
    fixedSvcSpy = jasmine.createSpyObj('FixedBookingsService', [
      'findAll',
      'create',
      'update',
      'generateNext',
      'deleteFixedBookingCascade',
    ]);
    courtsSvcSpy = jasmine.createSpyObj('CourtsService', ['loadCourts'], {
      courts$: courtsSubject.asObservable(),
    });
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error', 'info']);
    teachersSvcSpy = jasmine.createSpyObj('TeachersService', ['findAll']);

    fixedSvcSpy.findAll.and.returnValue(of([bookingA]));
    teachersSvcSpy.findAll.and.returnValue(of([teacher]));

    TestBed.configureTestingModule({
    imports: [FixedBookingsComponent],
    providers: [
        { provide: FixedBookingsService, useValue: fixedSvcSpy },
        { provide: CourtsService, useValue: courtsSvcSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: TeachersService, useValue: teachersSvcSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('loads fixed bookings, courts and teachers, and selects the first available court', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.fixedBookings()).toEqual([bookingA]);
    expect(component.teachers()).toEqual([teacher]);
    expect(component.isLoading()).toBe(false);
    expect(component.selectedCourtId).toBe('c1');
  });

  it('toasts an error when loading fixed bookings fails', () => {
    setup();
    fixedSvcSpy.findAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('filteredBookings filters by search term, day and court', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.searchTerm = 'maría';
    expect(component.filteredBookings.length).toBe(1);
    component.searchTerm = 'nomatch';
    expect(component.filteredBookings.length).toBe(0);

    component.searchTerm = '';
    component.filterDay = '2';
    expect(component.filteredBookings.length).toBe(0);
    component.filterDay = '1';
    expect(component.filteredBookings.length).toBe(1);
  });

  it('builds the grid: getSlotData finds the start slot and marks the spanned slot', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const start = component.getSlotData(1, '10:00');
    expect(start?.isStart).toBe(true);
    expect(start?.rowSpan).toBe(2); // 60min = 2 * 30min slots

    const spanned = component.getSlotData(1, '10:30');
    expect(spanned?.isStart).toBe(false);
  });

  it('getEndHour computes hour + duration correctly', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.getEndHour(bookingA)).toBe('11:00');
  });

  it('selectCourt() updates selectedCourtId and rebuilds the grid', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.selectCourt('c1');
    expect(fixture.componentInstance.selectedCourtId).toBe('c1');
  });

  it('openDetail() blocks editing a booking on an inactive court', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const inactiveCourtBooking = {
      ...bookingA,
      court: { id: 'c1', name: 'Cancha 1', isActive: false },
    };

    fixture.componentInstance.openDetail(inactiveCourtBooking);

    expect(toastServiceSpy.info).toHaveBeenCalled();
    expect(fixture.componentInstance.selectedFixedBooking()).toBeNull();
  });

  it('openDetail() opens the panel for an active-court booking', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openDetail(bookingA);
    expect(fixture.componentInstance.selectedFixedBooking()).toEqual(bookingA);
  });

  it('onDayOfWeekChange() sets startDate to the next matching weekday', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.dayOfWeek = 1;
    component.onDayOfWeekChange();
    expect(component.form.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('onIsTeacherClassChange() clears teacher/client when turned off', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.teacherId = 't1';
    component.form.clientName = 'Clase - Prof. Juan';
    component.form.isTeacherClass = false;
    component.onIsTeacherClassChange();
    expect(component.form.teacherId).toBe('');
    expect(component.form.clientName).toBe('');
  });

  it('onTeacherSelectChange() autofills clientName and phone from the teacher', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.onTeacherSelectChange('t1');
    expect(fixture.componentInstance.form.clientName).toBe('Clase - Prof. Juan');
    expect(fixture.componentInstance.form.phoneNumber).toBe('1122334455');
  });

  it('submitForm() requires a client name', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.clientName = '';

    fixture.componentInstance.submitForm();

    expect(fixture.componentInstance.formError()).toContain('obligatorio');
    expect(fixedSvcSpy.create).not.toHaveBeenCalled();
  });

  it('submitForm() creates a new fixed booking with a valid, non-structural form', () => {
    setup();
    fixedSvcSpy.create.and.returnValue(of(bookingA));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.clientName = 'Nuevo';
    fixture.componentInstance.form.courtId = 'c1';
    fixture.componentInstance.form.startDate = '2026-02-01';

    fixture.componentInstance.submitForm();

    expect(fixedSvcSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.isDialogOpen()).toBe(false);
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('submitForm() asks for confirmation before applying a structural change in edit mode', () => {
    setup();
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false } as any));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openEditDialog(bookingA);
    fixture.componentInstance.form.hour = '11:00'; // structural change

    fixture.componentInstance.submitForm();

    expect(Swal.fire).toHaveBeenCalled();
    expect(fixedSvcSpy.update).not.toHaveBeenCalled();
  });

  it('submitForm() updates directly in edit mode when nothing structural changed', () => {
    setup();
    fixedSvcSpy.update.and.returnValue(of(bookingA));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openEditDialog(bookingA);
    fixture.componentInstance.form.notes = 'nota nueva';

    fixture.componentInstance.submitForm();

    expect(fixedSvcSpy.update).toHaveBeenCalledWith('fb1', jasmine.any(Object));
  });

  it('shows a Swal error on CONFLICT_OVERLAP (409)', () => {
    setup();
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({} as any));
    fixedSvcSpy.create.and.returnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'CONFLICT_OVERLAP', detail: 'Se superpone' },
      })),
    );
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.clientName = 'Nuevo';
    fixture.componentInstance.form.courtId = 'c1';
    fixture.componentInstance.form.startDate = '2026-02-01';

    fixture.componentInstance.submitForm();

    expect(Swal.fire).toHaveBeenCalled();
    expect(fixture.componentInstance.isSubmitting()).toBe(false);
  });

  it('offers to retry with the next available date on CONFLICT_START_DATE (409)', () => {
    setup();
    spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({ isConfirmed: true } as any),
    );
    fixedSvcSpy.create.and.returnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'CONFLICT_START_DATE', nextAvailableDate: '2026-02-08' },
      })),
    );
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.clientName = 'Nuevo';
    fixture.componentInstance.form.courtId = 'c1';
    fixture.componentInstance.form.startDate = '2026-02-01';

    fixture.componentInstance.submitForm();

    expect(Swal.fire).toHaveBeenCalled();
  });

  it('generateNext() reports the number of generated bookings', () => {
    setup();
    fixedSvcSpy.generateNext.and.returnValue(of({ generated: 8 }));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();

    fixture.componentInstance.generateNext(bookingA);

    expect(fixedSvcSpy.generateNext).toHaveBeenCalledWith('fb1');
    expect(toastServiceSpy.success).toHaveBeenCalled();
    expect(fixture.componentInstance.generatingId()).toBeNull();
  });

  it('deleteCascade() does nothing if the user cancels the Swal confirmation', () => {
    setup();
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false } as any));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteCascade(bookingA);

    expect(fixedSvcSpy.deleteFixedBookingCascade).not.toHaveBeenCalled();
  });

  it('deleteCascade() deletes and reloads when confirmed', async () => {
    setup();
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: true } as any));
    fixedSvcSpy.deleteFixedBookingCascade.and.returnValue(of({ deleted: 3, preserved: 0 }));
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteCascade(bookingA);
    await Promise.resolve();

    expect(fixedSvcSpy.deleteFixedBookingCascade).toHaveBeenCalledWith('fb1');
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('whatsapp() opens a wa.me link built from the client name and schedule', () => {
    setup();
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.whatsapp(bookingA);
    expect(windowOpenSpy).toHaveBeenCalled();
    expect(windowOpenSpy.calls.mostRecent().args[0]).toContain('https://wa.me/1100000000');
  });

  it('whatsapp() does nothing without a phone number', () => {
    setup();
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.whatsapp({ ...bookingA, phoneNumber: null });
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it('dayLabel() maps ISO weekday numbers to Spanish names', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.dayLabel(1)).toBe('Lunes');
    expect(fixture.componentInstance.dayLabel(7)).toBe('Domingo');
  });

  it('onEscape() closes the detail panel first, then the dialog', () => {
    setup();
    const fixture = TestBed.createComponent(FixedBookingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openDetail(bookingA);
    component.onEscape();
    expect(component.selectedFixedBooking()).toBeNull();

    component.openCreateDialog();
    component.onEscape();
    expect(component.isDialogOpen()).toBe(false);
  });
});
