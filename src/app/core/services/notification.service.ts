import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { AppNotification } from '../models/notification.model';

/**
 * Servicio singleton de notificaciones reactivas del frontend.
 *
 * Cualquier feature puede inyectarlo para:
 *  - `add()` — publicar una alerta (watchdog de turnos con retraso, etc.)
 *  - `removeById()` — descartar manualmente desde la campanita
 *  - `removeByEntityId()` — auto-limpieza al iniciar un partido
 *  - `clearAllNotifications()` — limpiar todo desde el panel
 *
 * Las notificaciones se persisten en localStorage bajo `caldera_notifications`
 * para sobrevivir recargas de página.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly STORAGE_KEY = 'caldera_notifications';

  private readonly _notifications$ = new BehaviorSubject<AppNotification[]>(
    this.loadFromStorage(),
  );

  /** Observable del array de notificaciones activas. */
  readonly notifications$ = this._notifications$.asObservable();

  /** Número actual de notificaciones no leídas. */
  get count(): number {
    return this._notifications$.value.length;
  }

  /**
   * Agrega una notificación. Si ya existe una con el mismo `id`, la ignora
   * para evitar duplicados entre ticks del watchdog.
   */
  add(notification: AppNotification): void {
    const current = this._notifications$.value;
    if (current.some((n) => n.id === notification.id)) return;
    const next = [notification, ...current];
    this._notifications$.next(next);
    this.saveToStorage(next);
  }

  /** Elimina una notificación por su ID (descarte manual desde la UI). */
  removeById(id: string): void {
    const next = this._notifications$.value.filter((n) => n.id !== id);
    this._notifications$.next(next);
    this.saveToStorage(next);
  }

  /**
   * Elimina todas las notificaciones vinculadas a una entidad.
   * Llamado automáticamente al iniciar un partido (`onStartPlaying`)
   * para limpiar la alerta de retraso sin acción manual del usuario.
   */
  removeByEntityId(entityId: string): void {
    const next = this._notifications$.value.filter(
      (n) => n.entityId !== entityId,
    );
    this._notifications$.next(next);
    this.saveToStorage(next);
  }

  /** Elimina todas las notificaciones activas (acción "Limpiar todas" del panel). */
  clearAllNotifications(): void {
    this._notifications$.next([]);
    this.saveToStorage([]);
  }

  /** Carga las notificaciones persistidas en localStorage al iniciar el servicio. */
  private loadFromStorage(): AppNotification[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AppNotification[];
      return parsed.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }));
    } catch {
      return [];
    }
  }

  /** Persiste el array de notificaciones actual en localStorage. */
  private saveToStorage(notifications: AppNotification[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    } catch {}
  }
}
