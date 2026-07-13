import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { PricingShiftsComponent } from './pricing-shifts.component';
import { PricingShiftsService } from '../../core/services/pricing-shifts.service';
import { PricingShift } from '../../core/models/pricing-shift.model';

describe('PricingShiftsComponent', () => {
  let serviceSpy: jasmine.SpyObj<PricingShiftsService>;

  const shift: PricingShift = {
    id: 's1',
    name: 'Horario pico',
    startTime: '18:00',
    endTime: '23:00',
    daysOfWeek: [1, 2, 3],
    price30min: 1500,
    price60min: 3000,
    price90min: 4500,
    price120min: 6000,
    teacherPricePerHour: 2500,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('PricingShiftsService', [
      'getAll',
      'create',
      'update',
      'delete',
    ]);
    serviceSpy.getAll.and.returnValue(of([shift]));

    await TestBed.configureTestingModule({
      declarations: [PricingShiftsComponent],
      imports: [ReactiveFormsModule],
      providers: [{ provide: PricingShiftsService, useValue: serviceSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('loads shifts on init', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.shifts).toEqual([shift]);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('sets serverError when loading fails', () => {
    serviceSpy.getAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.serverError).toContain('No se pudieron cargar');
  });

  it('openCreate() builds an empty form and opens the modal', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    expect(fixture.componentInstance.showModal).toBe(true);
    expect(fixture.componentInstance.editingId).toBeNull();
    expect(fixture.componentInstance.selectedDays).toEqual([]);
  });

  it('openEdit() pre-fills the form and selected days from the shift', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openEdit(shift);
    expect(fixture.componentInstance.editingId).toBe('s1');
    expect(fixture.componentInstance.selectedDays).toEqual([1, 2, 3]);
    expect(fixture.componentInstance.form.value.name).toBe('Horario pico');
  });

  it('toggleDay() adds and removes a day from the selection', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.toggleDay(1);
    expect(fixture.componentInstance.isDaySelected(1)).toBe(true);
    fixture.componentInstance.toggleDay(1);
    expect(fixture.componentInstance.isDaySelected(1)).toBe(false);
  });

  it('onSubmit() requires at least one selected day', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form.patchValue({
      name: 'Test',
      startTime: '09:00',
      endTime: '18:00',
      price60min: 3000,
      teacherPricePerHour: 2000,
    });

    fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.modalError).toContain('Seleccioná al menos un día');
    expect(serviceSpy.create).not.toHaveBeenCalled();
  });

  it('onSubmit() creates a shift when the form is valid and closes the modal', () => {
    serviceSpy.create.and.returnValue(of(shift));
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form.patchValue({
      name: 'Test',
      startTime: '09:00',
      endTime: '18:00',
      price60min: 3000,
      teacherPricePerHour: 2000,
    });
    fixture.componentInstance.toggleDay(1);

    fixture.componentInstance.onSubmit();

    expect(serviceSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.showModal).toBe(false);
  });

  it('formatDays() maps day numbers to sorted Spanish abbreviations', () => {
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.formatDays([3, 1])).toBe('Lun, Mié');
  });

  it('confirmDelete() calls delete for the marked shift id and reloads', () => {
    serviceSpy.delete.and.returnValue(of(undefined));
    const fixture = TestBed.createComponent(PricingShiftsComponent);
    fixture.detectChanges();
    fixture.componentInstance.requestDelete('s1');
    fixture.componentInstance.confirmDelete();
    expect(serviceSpy.delete).toHaveBeenCalledWith('s1');
    expect(fixture.componentInstance.deleteConfirmId).toBeNull();
  });
});
