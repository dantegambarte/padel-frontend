import { ChangeDetectionStrategy, Component, OnInit, HostListener, computed, signal } from '@angular/core';
import Swal from 'sweetalert2';

import { TeachersService } from '../../core/services/teachers.service';
import { ToastService } from '../../core/services/toast.service';
import { Teacher, CreateTeacherDto } from '../../core/models/teacher.model';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';

type FormState = {
  fullName: string;
  phoneNumber: string;
};

const EMPTY_FORM = (): FormState => ({
  fullName: '',
  phoneNumber: '',
});

@Component({
    selector: 'app-teachers',
    templateUrl: './teachers.component.html',
    imports: [
    ReactiveFormsModule,
    FormsModule,
    NgClass,
    ModalScrollLockDirective
],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachersComponent implements OnInit, CanComponentDeactivate {
  teachers = signal<Teacher[]>([]);
  isLoading = signal(true);
  isSubmitting = signal(false);
  togglingId = signal<string | null>(null);

  isDialogOpen = signal(false);
  editingId = signal<string | null>(null);
  form: FormState = EMPTY_FORM();
  formError = signal('');

  /** Snapshot del formulario en el momento de abrir el diálogo. */
  private initialForm: FormState | null = null;

  searchTerm = '';

  constructor(
    private teachersSvc: TeachersService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  @HostListener('document:keydown.escape')
  /** Cierra el diálogo abierto al presionar Escape. */
  onEscape(): void {
    if (this.isDialogOpen()) this.closeDialog();
  }

  /** Profesores filtrados por el término de búsqueda (nombre o teléfono). */
  get filteredTeachers(): Teacher[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.teachers();
    return this.teachers().filter(
      (t) =>
        t.fullName.toLowerCase().includes(term) ||
        (t.phoneNumber ?? '').includes(term),
    );
  }

  /** Título del diálogo según modo creación o edición. */
  dialogTitle = computed(() =>
    this.editingId() ? 'Editar Profesor' : 'Nuevo Profesor',
  );

  /** Abre el diálogo de creación con el formulario vacío. */
  openCreateDialog(): void {
    this.editingId.set(null);
    this.form = EMPTY_FORM();
    this.initialForm = EMPTY_FORM();
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  /** Abre el diálogo de edición pre-poblado con los datos del profesor. */
  openEditDialog(teacher: Teacher): void {
    this.editingId.set(teacher.id);
    this.form = {
      fullName: teacher.fullName,
      phoneNumber: teacher.phoneNumber ?? '',
    };
    this.initialForm = { ...this.form };
    this.formError.set('');
    this.isDialogOpen.set(true);
  }

  /** Cierra el diálogo y limpia el estado de edición. */
  closeDialog(): void {
    this.isDialogOpen.set(false);
    this.editingId.set(null);
    this.initialForm = null;
  }

  /** Valida el formulario y envía el DTO de creación o actualización al servicio. */
  submitForm(): void {
    if (!this.form.fullName.trim()) {
      this.formError.set('El nombre del profesor es obligatorio.');
      return;
    }

    this.formError.set('');
    this.isSubmitting.set(true);

    const dto: CreateTeacherDto = {
      fullName: this.form.fullName.trim(),
      phoneNumber: this.form.phoneNumber.trim() || undefined,
    };

    const editingId = this.editingId();
    const op = editingId
      ? this.teachersSvc.update(editingId, dto)
      : this.teachersSvc.create(dto);

    op.subscribe({
      next: () => {
        this.toast.success(
          editingId ? 'Profesor actualizado' : 'Profesor creado',
          editingId
            ? 'Los datos fueron guardados.'
            : 'El profesor ya está disponible en la agenda.',
        );
        this.closeDialog();
        this.loadAll();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        const msg =
          err?.error?.message ?? 'Error al guardar. Intente nuevamente.';
        this.formError.set(Array.isArray(msg) ? msg.join(' ') : msg);
        this.isSubmitting.set(false);
      },
    });
  }

  /** Activa o desactiva un profesor sin abrir el modal de confirmación. */
  toggleActive(teacher: Teacher): void {
    this.togglingId.set(teacher.id);
    this.teachersSvc
      .update(teacher.id, { isActive: !teacher.isActive })
      .subscribe({
        next: () => {
          this.toast.success(
            teacher.isActive ? 'Profesor desactivado' : 'Profesor activado',
            `${teacher.fullName} fue ${teacher.isActive ? 'desactivado' : 'activado'}.`,
          );
          this.togglingId.set(null);
          this.loadAll();
        },
        error: () => {
          this.toast.error(
            'Error',
            'No se pudo cambiar el estado del profesor.',
          );
          this.togglingId.set(null);
        },
      });
  }

  /** Muestra el diálogo de confirmación y desactiva al profesor si se confirma. */
  confirmDelete(teacher: Teacher): void {
    Swal.fire({
      title: 'Desactivar Profesor',
      html: `¿Desactivar a <strong>${teacher.fullName}</strong>?<br><br>
             No podrá ser asignado a nuevos turnos, pero los turnos existentes no se verán afectados.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.togglingId.set(teacher.id);
      this.teachersSvc.deactivate(teacher.id).subscribe({
        next: () => {
          this.toast.success(
            'Profesor desactivado',
            `${teacher.fullName} fue desactivado.`,
          );
          this.togglingId.set(null);
          this.loadAll();
        },
        error: () => {
          this.toast.error('Error', 'No se pudo desactivar el profesor.');
          this.togglingId.set(null);
        },
      });
    });
  }

  /** Abre WhatsApp Web con el número del profesor. */
  whatsapp(teacher: Teacher): void {
    if (!teacher.phoneNumber) return;
    const phone = teacher.phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  }

  /** Carga todos los profesores (activos e inactivos) desde el servidor. */
  private loadAll(): void {
    this.isLoading.set(true);
    this.teachersSvc.findAll(true).subscribe({
      next: (data) => {
        this.teachers.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar los profesores.');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Requerido por CanComponentDeactivate.
   * Retorna `false` si el diálogo está abierto con cambios no guardados,
   * lo que dispara el modal de confirmación del UnsavedChangesGuard.
   */
  canDeactivate(): boolean {
    return !this.isDialogFormDirty();
  }

  /** True si el formulario del diálogo tiene cambios respecto al estado inicial. */
  private isDialogFormDirty(): boolean {
    if (!this.isDialogOpen() || !this.initialForm) return false;
    return (
      this.form.fullName !== this.initialForm.fullName ||
      this.form.phoneNumber !== this.initialForm.phoneNumber
    );
  }
}
