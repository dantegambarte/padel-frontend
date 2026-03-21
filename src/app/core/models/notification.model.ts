/** Categoría de una notificación para agrupación visual en el panel. */
export type NotificationCategory = 'TURNOS' | 'STOCK' | 'CAJA' | 'SISTEMA';

/** Notificación reactiva generada en el frontend (watchdog de turnos, etc.). */
export interface AppNotification {
  /** ID único de la notificación (ej: `delay-<bookingId>`). */
  id: string;
  title: string;
  message: string;
  /** Categoría para agrupar en el panel de la campanita. */
  category: NotificationCategory;
  /** Ruta de navegación para `router.navigate()`. Ej: `['/app/schedule']`. */
  actionRoute: string[];
  /** Query params opcionales para deep linking (ej: `{ date, openBooking }`). */
  queryParams?: Record<string, string>;
  /** ID de la entidad vinculada (turno, producto, etc.) para sincronizar auto-limpieza. */
  entityId: string;
  createdAt: Date;
}
