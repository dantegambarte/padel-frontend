import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { ConfigService, ConfigEntry } from '../../core/services/config.service';
import { CourtsService } from '../../core/services/courts.service';
import { ToastService } from '../../core/services/toast.service';
import { Court } from '../../core/models/court.model';

describe('SettingsComponent', () => {
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let courtsServiceSpy: jasmine.SpyObj<CourtsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let courtsSubject: Subject<Court[]>;

  const court: Court = { id: 'c1', name: 'Cancha 1', description: '', isActive: true };

  beforeEach(async () => {
    courtsSubject = new Subject<Court[]>();
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getAll', 'updateBulk']);
    courtsServiceSpy = jasmine.createSpyObj('CourtsService', ['loadCourts', 'create', 'update', 'delete'], {
      courts$: courtsSubject.asObservable(),
    });
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);

    const entries: ConfigEntry[] = [
      { key: 'hora_apertura', value: '08:00' },
      { key: 'hora_cierre', value: '22:00' },
      { key: 'fondo_caja_base', value: '5000' },
    ];
    configServiceSpy.getAll.and.returnValue(of(entries));

    await TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: CourtsService, useValue: courtsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads config and applies it to the form', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.horarioApertura).toBe('08:00');
    expect(component.horarioCierre).toBe('22:00');
    expect(component.fondoCajaBase).toBe(5000);
    expect(component.isLoading).toBe(false);
  });

  it('mirrors courts from the courts$ stream', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    courtsSubject.next([court]);
    expect(fixture.componentInstance.courts).toEqual([court]);
  });

  it('isHorariosDirty reflects unsaved schedule changes', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isHorariosDirty).toBe(false);
    fixture.componentInstance.horarioApertura = '09:00';
    expect(fixture.componentInstance.isHorariosDirty).toBe(true);
  });

  it('save() persists the schedule and clears the dirty flag', () => {
    configServiceSpy.updateBulk.and.returnValue(of([]));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.horarioApertura = '09:00';

    fixture.componentInstance.save();

    expect(configServiceSpy.updateBulk).toHaveBeenCalled();
    expect(fixture.componentInstance.isHorariosDirty).toBe(false);
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('save() toasts an error on failure', () => {
    configServiceSpy.updateBulk.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    fixture.componentInstance.save();

    expect(toastServiceSpy.error).toHaveBeenCalled();
  });

  it('canDeactivate() is false while there are unsaved changes', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.fondoCajaBase = 9999;
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
  });

  it('saveCourtModal() requires a court name', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateCourtModal();
    fixture.componentInstance.courtForm.name = '  ';

    fixture.componentInstance.saveCourtModal();

    expect(fixture.componentInstance.courtFormError).toContain('obligatorio');
    expect(courtsServiceSpy.create).not.toHaveBeenCalled();
  });

  it('saveCourtModal() creates a court in create mode', () => {
    courtsServiceSpy.create.and.returnValue(of(court));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateCourtModal();
    fixture.componentInstance.courtForm.name = 'Cancha Nueva';

    fixture.componentInstance.saveCourtModal();

    expect(courtsServiceSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.isCourtModalOpen).toBe(false);
  });

  it('deleteCourt() calls the service for the confirmed court', () => {
    courtsServiceSpy.delete.and.returnValue(of(undefined));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.confirmDeleteCourt(court);

    fixture.componentInstance.deleteCourt();

    expect(courtsServiceSpy.delete).toHaveBeenCalledWith('c1');
    expect(fixture.componentInstance.courtToDelete).toBeNull();
  });
});
