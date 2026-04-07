import { Component, OnInit, HostListener } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ConfigService, ConfigEntry } from '../../core/services/config.service';
import { CourtsService } from '../../core/services/courts.service';
import {
  Court,
  CreateCourtDto,
  UpdateCourtDto,
} from '../../core/models/court.model';
import { ToastService } from '../../core/services/toast.service';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit, CanComponentDeactivate {
  isLoading = true;
  isSubmitting = false;

  horarioApertura = '09:00';
  horarioCierre = '23:00';

  private savedHorarioApertura = '';
  private savedHorarioCierre = '';

  /**
   * `true` si algún campo difiere del snapshot guardado al cargar.
   * Implementa dirty state manual ya que el componente no usa ReactiveFormsModule.
   */
  get isDirty(): boolean {
    return (
      this.horarioApertura !== this.savedHorarioApertura ||
      this.horarioCierre !== this.savedHorarioCierre
    );
  }

  courts: Court[] = [];
  courtToDelete: Court | null = null;

  isCourtModalOpen = false;
  isCourtSubmitting = false;
  courtModalMode: 'create' | 'edit' = 'create';
  editingCourtId: string | null = null;
  courtFormError = '';

  courtForm = { name: '', description: '', isActive: true };

  constructor(
    private configService: ConfigService,
    private courtsService: CourtsService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  @HostListener('document:keydown.escape')
  /** Cancela la confirmación de borrado o cierra el modal de cancha al presionar Escape. */
  onEscape(): void {
    if (this.courtToDelete) {
      this.courtToDelete = null;
      return;
    }
    if (this.isCourtModalOpen && !this.isCourtSubmitting) {
      this.closeCourtModal();
    }
  }

  /** Carga la configuración y la lista de canchas en paralelo. */
  private loadAll(): void {
    this.isLoading = true;
    forkJoin({
      config: this.configService.getAll().pipe(catchError(() => of([]))),
      courts: this.courtsService.findAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ config, courts }) => {
        this.isLoading = false;
        this.courts = courts as Court[];
        this.applyConfig(config as ConfigEntry[]);
      },
      error: () => {
        this.isLoading = false;
        this.toast.error(
          'Error al cargar configuración',
          'Intente recargar la página',
        );
      },
    });
  }

  /**
   * Aplica las entradas de configuración al formulario y actualiza el snapshot
   * para que el formulario quede en estado "limpio" al cargar.
   */
  private applyConfig(entries: ConfigEntry[]): void {
    if (!Array.isArray(entries)) return;
    const map = new Map(entries.map((e) => [e.key, e.value]));
    if (map.has('hora_apertura'))
      this.horarioApertura = map.get('hora_apertura')!;
    if (map.has('hora_cierre')) this.horarioCierre = map.get('hora_cierre')!;

    this.savedHorarioApertura = this.horarioApertura;
    this.savedHorarioCierre = this.horarioCierre;
  }

  /** Guarda la configuración de horarios y actualiza el snapshot. */
  save(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const entries: ConfigEntry[] = [
      { key: 'hora_apertura', value: this.horarioApertura },
      { key: 'hora_cierre', value: this.horarioCierre },
    ];

    this.configService
      .updateBulk(entries)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.savedHorarioApertura = this.horarioApertura;
          this.savedHorarioCierre = this.horarioCierre;
          this.toast.success(
            'Configuración guardada',
            'Los cambios se aplicarán de inmediato',
          );
        },
        error: () =>
          this.toast.error(
            'Error al guardar',
            'No se pudo guardar la configuración',
          ),
      });
  }

  /** Descarta los cambios pendientes recargando la configuración desde el servidor. */
  cancel(): void {
    this.loadAll();
  }

  /** Abre el modal en modo creación con el formulario vacío. */
  openCreateCourtModal(): void {
    this.courtModalMode = 'create';
    this.editingCourtId = null;
    this.courtFormError = '';
    this.courtForm = { name: '', description: '', isActive: true };
    this.isCourtModalOpen = true;
  }

  /** Abre el modal en modo edición pre-cargando los datos de la cancha. */
  openEditCourtModal(court: Court): void {
    this.courtModalMode = 'edit';
    this.editingCourtId = court.id;
    this.courtFormError = '';
    this.courtForm = {
      name: court.name,
      description: court.description ?? '',
      isActive: court.isActive,
    };
    this.isCourtModalOpen = true;
  }

  /** Cierra el modal de cancha si no hay una petición en curso. */
  closeCourtModal(): void {
    if (this.isCourtSubmitting) return;
    this.isCourtModalOpen = false;
  }

  /** Valida y envía el formulario de cancha para creación o edición. */
  saveCourtModal(): void {
    this.courtFormError = '';

    if (!this.courtForm.name.trim()) {
      this.courtFormError = 'El nombre de la cancha es obligatorio.';
      return;
    }

    this.isCourtSubmitting = true;

    if (this.courtModalMode === 'create') {
      const dto: CreateCourtDto = {
        name: this.courtForm.name.trim(),
        description: this.courtForm.description.trim() || undefined,
        isActive: this.courtForm.isActive,
      };

      this.courtsService.create(dto).subscribe({
        next: (created) => {
          this.isCourtSubmitting = false;
          this.isCourtModalOpen = false;
          this.courts = [...this.courts, created].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          this.toast.success(
            'Cancha creada',
            `"${created.name}" fue agregada al sistema`,
          );
        },
        error: (err) => {
          this.isCourtSubmitting = false;
          const msg = err?.error?.message ?? 'No se pudo crear la cancha';
          this.courtFormError = Array.isArray(msg) ? msg.join(', ') : msg;
        },
      });
    } else {
      const dto: UpdateCourtDto = {
        name: this.courtForm.name.trim(),
        description: this.courtForm.description.trim() || undefined,
        isActive: this.courtForm.isActive,
      };

      this.courtsService.update(this.editingCourtId!, dto).subscribe({
        next: (updated) => {
          this.isCourtSubmitting = false;
          this.isCourtModalOpen = false;
          this.courts = this.courts
            .map((c) => (c.id === updated.id ? updated : c))
            .sort((a, b) => a.name.localeCompare(b.name));
          this.toast.success(
            'Cancha actualizada',
            `"${updated.name}" fue modificada`,
          );
        },
        error: (err) => {
          this.isCourtSubmitting = false;
          const msg = err?.error?.message ?? 'No se pudo actualizar la cancha';
          this.courtFormError = Array.isArray(msg) ? msg.join(', ') : msg;
        },
      });
    }
  }

  /** Abre el modal de confirmación de eliminación. */
  confirmDeleteCourt(court: Court): void {
    this.courtToDelete = court;
  }

  /** Cancela la eliminación. */
  cancelDeleteCourt(): void {
    this.courtToDelete = null;
  }

  /** Ejecuta la eliminación de la cancha confirmada. */
  deleteCourt(): void {
    if (!this.courtToDelete) return;
    const id = this.courtToDelete.id;
    const name = this.courtToDelete.name;
    this.courtToDelete = null;
    this.courtsService.delete(id).subscribe({
      next: () => {
        this.courts = this.courts.filter((c) => c.id !== id);
        this.toast.success(
          'Cancha eliminada',
          `"${name}" fue eliminada del sistema`,
        );
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'No se pudo eliminar la cancha';
        this.toast.error(
          'Error al eliminar',
          Array.isArray(msg) ? msg.join(', ') : msg,
        );
      },
    });
  }

  /**
   * Requerido por CanComponentDeactivate.
   * Retorna `false` si hay cambios en horarios O en precios globales sin guardar,
   * lo que dispara el modal de confirmación del UnsavedChangesGuard.
   */
  canDeactivate(): boolean {
    return !this.isDirty;
  }
}
