import { Component, OnInit, HostListener } from '@angular/core';
import Swal from 'sweetalert2';

import { TeachersService } from '../../core/services/teachers.service';
import { ToastService } from '../../core/services/toast.service';
import { Teacher, CreateTeacherDto } from '../../core/models/teacher.model';

type FormState = {
  fullName: string;
  phoneNumber: string;
  email: string;
};

const EMPTY_FORM = (): FormState => ({
  fullName: '',
  phoneNumber: '',
  email: '',
});

@Component({
  selector: 'app-teachers',
  templateUrl: './teachers.component.html',
})
export class TeachersComponent implements OnInit {
  teachers: Teacher[] = [];
  isLoading = true;
  isSubmitting = false;
  togglingId: string | null = null;

  isDialogOpen = false;
  editingId: string | null = null;
  form: FormState = EMPTY_FORM();
  formError = '';

  searchTerm = '';

  constructor(
    private teachersSvc: TeachersService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  get filteredTeachers(): Teacher[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.teachers;
    return this.teachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(term) ||
        (t.phoneNumber ?? '').includes(term) ||
        (t.email ?? '').toLowerCase().includes(term),
    );
  }

  get dialogTitle(): string {
    return this.editingId ? 'Editar Profesor' : 'Nuevo Profesor';
  }

  openCreateDialog(): void {
    this.editingId = null;
    this.form = EMPTY_FORM();
    this.formError = '';
    this.isDialogOpen = true;
  }

  openEditDialog(teacher: Teacher): void {
    this.editingId = teacher.id;
    this.form = {
      fullName:    teacher.fullName,
      phoneNumber: teacher.phoneNumber ?? '',
      email:       teacher.email       ?? '',
    };
    this.formError = '';
    this.isDialogOpen = true;
  }

  closeDialog(): void {
    this.isDialogOpen = false;
    this.editingId = null;
  }

  submitForm(): void {
    if (!this.form.fullName.trim()) {
      this.formError = 'El nombre del profesor es obligatorio.';
      return;
    }

    this.formError = '';
    this.isSubmitting = true;

    const dto: CreateTeacherDto = {
      fullName:    this.form.fullName.trim(),
      phoneNumber: this.form.phoneNumber.trim() || undefined,
      email:       this.form.email.trim()       || undefined,
    };

    const op = this.editingId
      ? this.teachersSvc.update(this.editingId, dto)
      : this.teachersSvc.create(dto);

    op.subscribe({
      next: () => {
        this.toast.success(
          this.editingId ? 'Profesor actualizado' : 'Profesor creado',
          this.editingId ? 'Los datos fueron guardados.' : 'El profesor ya está disponible en la agenda.',
        );
        this.closeDialog();
        this.loadAll();
        this.isSubmitting = false;
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error al guardar. Intente nuevamente.';
        this.formError = Array.isArray(msg) ? msg.join(' ') : msg;
        this.isSubmitting = false;
      },
    });
  }

  toggleActive(teacher: Teacher): void {
    this.togglingId = teacher.id;
    this.teachersSvc
      .update(teacher.id, { isActive: !teacher.isActive })
      .subscribe({
        next: () => {
          this.toast.success(
            teacher.isActive ? 'Profesor desactivado' : 'Profesor activado',
            `${teacher.fullName} fue ${teacher.isActive ? 'desactivado' : 'activado'}.`,
          );
          this.togglingId = null;
          this.loadAll();
        },
        error: () => {
          this.toast.error('Error', 'No se pudo cambiar el estado del profesor.');
          this.togglingId = null;
        },
      });
  }

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
      this.togglingId = teacher.id;
      this.teachersSvc.deactivate(teacher.id).subscribe({
        next: () => {
          this.toast.success('Profesor desactivado', `${teacher.fullName} fue desactivado.`);
          this.togglingId = null;
          this.loadAll();
        },
        error: () => {
          this.toast.error('Error', 'No se pudo desactivar el profesor.');
          this.togglingId = null;
        },
      });
    });
  }

  whatsapp(teacher: Teacher): void {
    if (!teacher.phoneNumber) return;
    const phone = teacher.phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  }

  private loadAll(): void {
    this.isLoading = true;
    this.teachersSvc.findAllIncludingInactive().subscribe({
      next: (data) => {
        this.teachers = data;
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar los profesores.');
        this.isLoading = false;
      },
    });
  }
}
