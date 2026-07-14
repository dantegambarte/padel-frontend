import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TeachersComponent } from './teachers.component';
import { TeachersService } from '../../core/services/teachers.service';
import { ToastService } from '../../core/services/toast.service';
import { Teacher } from '../../core/models/teacher.model';

describe('TeachersComponent', () => {
  let teachersSvcSpy: jasmine.SpyObj<TeachersService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  const teacher: Teacher = {
    id: 't1',
    fullName: 'Juan Perez',
    phoneNumber: '1122334455',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(async () => {
    teachersSvcSpy = jasmine.createSpyObj('TeachersService', [
      'findAll',
      'create',
      'update',
      'deactivate',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    teachersSvcSpy.findAll.and.returnValue(of([teacher]));

    await TestBed.configureTestingModule({
    imports: [TeachersComponent],
    providers: [
        { provide: TeachersService, useValue: teachersSvcSpy },
        { provide: ToastService, useValue: toastServiceSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads all teachers (active + inactive) on init', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    expect(teachersSvcSpy.findAll).toHaveBeenCalledWith(true);
    expect(fixture.componentInstance.teachers()).toEqual([teacher]);
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('filteredTeachers filters by name or phone', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchTerm = 'perez';
    expect(component.filteredTeachers.length).toBe(1);
    component.searchTerm = 'nomatch';
    expect(component.filteredTeachers.length).toBe(0);
  });

  it('openCreateDialog() resets the form and opens the dialog', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    expect(fixture.componentInstance.isDialogOpen()).toBe(true);
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('openEditDialog() pre-fills the form from the teacher', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openEditDialog(teacher);
    expect(fixture.componentInstance.editingId()).toBe('t1');
    expect(fixture.componentInstance.form.fullName).toBe('Juan Perez');
  });

  it('submitForm() rejects an empty name', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.fullName = '   ';
    fixture.componentInstance.submitForm();
    expect(fixture.componentInstance.formError()).toContain('obligatorio');
    expect(teachersSvcSpy.create).not.toHaveBeenCalled();
  });

  it('submitForm() creates a teacher and closes the dialog', () => {
    teachersSvcSpy.create.and.returnValue(of(teacher));
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.fullName = 'Nuevo Profesor';

    fixture.componentInstance.submitForm();

    expect(teachersSvcSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.isDialogOpen()).toBe(false);
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('submitForm() surfaces the server error', () => {
    teachersSvcSpy.create.and.returnValue(
      throwError(() => ({ error: { message: 'Ya existe' } })),
    );
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.fullName = 'Dup';

    fixture.componentInstance.submitForm();

    expect(fixture.componentInstance.formError()).toBe('Ya existe');
    expect(fixture.componentInstance.isSubmitting()).toBe(false);
  });

  it('toggleActive() calls update with the flipped isActive and reloads', () => {
    teachersSvcSpy.update.and.returnValue(of({ ...teacher, isActive: false }));
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleActive(teacher);

    expect(teachersSvcSpy.update).toHaveBeenCalledWith('t1', { isActive: false });
  });

  it('whatsapp() opens a wa.me link stripped of non-digit chars', () => {
    const windowOpenSpy = spyOn(window, 'open');
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.whatsapp(teacher);
    expect(windowOpenSpy).toHaveBeenCalledWith('https://wa.me/1122334455', '_blank');
  });

  it('canDeactivate() is true when the dialog is closed', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('canDeactivate() is false when the dialog has unsaved changes', () => {
    const fixture = TestBed.createComponent(TeachersComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreateDialog();
    fixture.componentInstance.form.fullName = 'Cambiado';
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
  });
});
