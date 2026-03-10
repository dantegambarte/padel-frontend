import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ConfigService, ConfigEntry } from '../../core/services/config.service';
import { CourtsService } from '../../core/services/courts.service';
import { Court } from '../../core/models/court.model';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {

  isLoading    = true;
  isSubmitting = false;

  precioBase      = '3000';
  precioProfesor  = '2500';
  horarioApertura = '09:00';
  horarioCierre   = '23:00';

  courts: Court[] = [];

  constructor(
    private configService: ConfigService,
    private courtsService: CourtsService,
    private toast:         ToastService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    forkJoin({
      config: this.configService.getAll().pipe(catchError(() => of([]))),
      courts: this.courtsService.findAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ config, courts }) => {
        this.isLoading = false;
        this.courts    = courts as Court[];
        this.applyConfig(config as ConfigEntry[]);
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Error al cargar configuración', 'Intente recargar la página');
      },
    });
  }

  private applyConfig(entries: ConfigEntry[]): void {
    const map = new Map(entries.map(e => [e.key, e.value]));
    if (map.has('precio_base'))      this.precioBase      = map.get('precio_base')!;
    if (map.has('precio_profesor'))  this.precioProfesor  = map.get('precio_profesor')!;
    if (map.has('horario_apertura')) this.horarioApertura = map.get('horario_apertura')!;
    if (map.has('horario_cierre'))   this.horarioCierre   = map.get('horario_cierre')!;
  }

  get precioBaseNum():     number { return parseInt(this.precioBase     || '0', 10) || 0; }
  get precioProfesorNum(): number { return parseInt(this.precioProfesor || '0', 10) || 0; }

  save(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const entries: ConfigEntry[] = [
      { key: 'precio_base',      value: this.precioBase      },
      { key: 'precio_profesor',  value: this.precioProfesor  },
      { key: 'horario_apertura', value: this.horarioApertura },
      { key: 'horario_cierre',   value: this.horarioCierre   },
    ];

    this.configService.updateBulk(entries).pipe(
      finalize(() => (this.isSubmitting = false)),
    ).subscribe({
      next:  () => this.toast.success('Configuración guardada', 'Los cambios se aplicarán de inmediato'),
      error: () => this.toast.error('Error al guardar', 'No se pudo guardar la configuración'),
    });
  }

  cancel(): void {
    this.ngOnInit();
  }

  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }
}
