import { CanDeactivateFn } from '@angular/router';

import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

/**
 * Interfaz que deben implementar los componentes que quieren participar
 * en la Red de Seguridad UX. Retornar `true` permite la navegación;
 * retornar `false` dispara el modal de confirmación.
 */
export interface CanComponentDeactivate {
  canDeactivate(): boolean | Observable<boolean> | Promise<boolean>;
}

function showConfirmation(): Promise<boolean> {
  return Swal.fire({
    title: 'Cambios sin guardar',
    text: 'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir y perder los cambios?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, salir y perder cambios',
    cancelButtonText: 'No, quedarme',
    reverseButtons: true,
  }).then((result) => result.isConfirmed);
}

export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (
  component,
) => {
  const result = component.canDeactivate();

  if (result === true) return true;

  if (result === false) return showConfirmation();

  if (result instanceof Observable) {
    return result.pipe(
      switchMap((canLeave) =>
        canLeave ? of(true) : from(showConfirmation()),
      ),
    );
  }

  return (result as Promise<boolean>).then((canLeave) =>
    canLeave ? true : showConfirmation(),
  );
};
