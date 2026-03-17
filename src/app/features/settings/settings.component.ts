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

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  isLoading = true;
  isSubmitting = false;

  // ── Precios & horarios ──────────────────────────────────────────────────
  precioBase = '3000';
  precioProfesor = '2500';
  horarioApertura = '09:00';
  horarioCierre = '23:00';

  // Snapshot de los valores al cargar. Se compara contra los actuales para
  // determinar si el usuario realizó algún cambio (dirty state manual,
  // ya que el componente no usa ReactiveFormsModule).
  private savedPrecioBase = '';
  private savedPrecioProfesor = '';
  private savedHorarioApertura = '';
  private savedHorarioCierre = '';

  get isDirty(): boolean {
    return (
      this.precioBase       !== this.savedPrecioBase       ||
      this.precioProfesor   !== this.savedPrecioProfesor   ||
      this.horarioApertura  !== this.savedHorarioApertura  ||
      this.horarioCierre    !== this.savedHorarioCierre
    );
  }

  // ── Canchas ─────────────────────────────────────────────────────────────
  courts: Court[] = [];

  // ── Modal de cancha ─────────────────────────────────────────────────────
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
  onEscape(): void {
    if (this.isCourtModalOpen && !this.isCourtSubmitting) {
      this.closeCourtModal();
    }
  }

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

  private applyConfig(entries: ConfigEntry[]): void {
    if (!Array.isArray(entries)) return;
    const map = new Map(entries.map((e) => [e.key, e.value]));
    if (map.has('precio_base'))      this.precioBase      = map.get('precio_base')!;
    if (map.has('precio_profesor'))  this.precioProfesor  = map.get('precio_profesor')!;
    if (map.has('horario_apertura')) this.horarioApertura = map.get('horario_apertura')!;
    if (map.has('horario_cierre'))   this.horarioCierre   = map.get('horario_cierre')!;

    // Actualizar snapshot: a partir de aquí el formulario está "limpio"
    this.savedPrecioBase      = this.precioBase;
    this.savedPrecioProfesor  = this.precioProfesor;
    this.savedHorarioApertura = this.horarioApertura;
    this.savedHorarioCierre   = this.horarioCierre;
  }

  get precioBaseNum(): number {
    return parseInt(this.precioBase || '0', 10) || 0;
  }
  get precioProfesorNum(): number {
    return parseInt(this.precioProfesor || '0', 10) || 0;
  }

  // ── Guardar configuración de precios/horarios ───────────────────────────

  save(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const entries: ConfigEntry[] = [
      { key: 'precio_base', value: this.precioBase },
      { key: 'precio_profesor', value: this.precioProfesor },
      { key: 'horario_apertura', value: this.horarioApertura },
      { key: 'horario_cierre', value: this.horarioCierre },
    ];

    this.configService
      .updateBulk(entries)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          // Actualizar snapshot para que el formulario vuelva a estado "limpio"
          this.savedPrecioBase      = this.precioBase;
          this.savedPrecioProfesor  = this.precioProfesor;
          this.savedHorarioApertura = this.horarioApertura;
          this.savedHorarioCierre   = this.horarioCierre;
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

  cancel(): void {
    this.loadAll();
  }

  // ── Modal de canchas ────────────────────────────────────────────────────

  openCreateCourtModal(): void {
    this.courtModalMode = 'create';
    this.editingCourtId = null;
    this.courtFormError = '';
    this.courtForm = { name: '', description: '', isActive: true };
    this.isCourtModalOpen = true;
  }

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

  closeCourtModal(): void {
    if (this.isCourtSubmitting) return;
    this.isCourtModalOpen = false;
  }

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

  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }
}
