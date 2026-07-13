import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { SettleDebtModalComponent } from './settle-debt-modal.component';
import { InternalConsumptionService } from '../../../core/services/internal-consumption.service';
import { Teacher } from '../../../core/models/teacher.model';
import { InternalConsumption, TeacherDebtSummary } from '../../../core/models/internal-consumption.model';

describe('SettleDebtModalComponent', () => {
  let serviceSpy: jasmine.SpyObj<InternalConsumptionService>;

  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan',
    phoneNumber: '+5491100000000',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const summary: TeacherDebtSummary = { teacherId: 't1', totalItems: 2, totalCost: 1600 };

  const consumption: InternalConsumption = {
    id: 'ic1',
    productId: 'p1',
    product: { id: 'p1', name: 'Gatorade', icon: 'inventory_2' },
    quantity: 2,
    consumerType: 'teacher',
    userId: null,
    user: null,
    teacherId: 't1',
    teacher: null,
    status: 'pending_payment',
    notes: null,
    unitCostPrice: 800,
    date: '2026-01-01',
    createdByUserId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('InternalConsumptionService', [
      'getAll',
      'settleTeacherDebt',
      'buildDebtReminderWhatsAppUrl',
    ]);
    serviceSpy.getAll.and.returnValue(of([consumption]));

    await TestBed.configureTestingModule({
      declarations: [SettleDebtModalComponent],
      providers: [{ provide: InternalConsumptionService, useValue: serviceSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function createWithInputs() {
    const fixture = TestBed.createComponent(SettleDebtModalComponent);
    fixture.componentInstance.teacher = teacher;
    fixture.componentInstance.summary = summary;
    fixture.detectChanges();
    return fixture;
  }

  it('loads pending consumptions for the given teacher on init', () => {
    const fixture = createWithInputs();
    expect(serviceSpy.getAll).toHaveBeenCalledWith({
      teacherId: 't1',
      status: 'pending_payment',
    });
    expect(fixture.componentInstance.consumptions.length).toBe(1);
    expect(fixture.componentInstance.loading).toBe(false);
  });

  it('total sums unitCostPrice * quantity across consumptions', () => {
    const fixture = createWithInputs();
    expect(fixture.componentInstance.total).toBe(1600);
  });

  it('onSettle() emits settled on success', () => {
    serviceSpy.settleTeacherDebt.and.returnValue(of([consumption]));
    const fixture = createWithInputs();
    const emitSpy = spyOn(fixture.componentInstance.settled, 'emit');

    fixture.componentInstance.onSettle();

    expect(serviceSpy.settleTeacherDebt).toHaveBeenCalledWith({
      teacherId: 't1',
      paymentMethod: 'cash',
    });
    expect(emitSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.settling).toBe(false);
  });

  it('onSettle() shows a Swal alert on error without emitting settled', () => {
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({} as any));
    serviceSpy.settleTeacherDebt.and.returnValue(
      throwError(() => ({ error: { errorCode: 'CAJA_CERRADA' } })),
    );
    const fixture = createWithInputs();
    const emitSpy = spyOn(fixture.componentInstance.settled, 'emit');

    fixture.componentInstance.onSettle();

    expect(Swal.fire).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settling).toBe(false);
  });

  it('onCancel() emits cancelled', () => {
    const fixture = createWithInputs();
    const emitSpy = spyOn(fixture.componentInstance.cancelled, 'emit');
    fixture.componentInstance.onCancel();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('sendDebtReminder() opens a WhatsApp URL when the teacher has a phone number', () => {
    serviceSpy.buildDebtReminderWhatsAppUrl.and.returnValue('https://wa.me/5491100000000');
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = createWithInputs();

    fixture.componentInstance.sendDebtReminder();

    expect(serviceSpy.buildDebtReminderWhatsAppUrl).toHaveBeenCalledWith(
      '+5491100000000',
      'Juan',
      1600,
    );
    expect(windowOpenSpy).toHaveBeenCalled();
  });

  it('sendDebtReminder() does nothing when the teacher has no phone number', () => {
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = createWithInputs();
    fixture.componentInstance.teacher = { ...teacher, phoneNumber: null };

    fixture.componentInstance.sendDebtReminder();

    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});
