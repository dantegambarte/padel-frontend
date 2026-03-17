import { Directive, OnInit, OnDestroy } from '@angular/core';

/**
 * Directiva que bloquea el scroll del body cuando un modal se monta
 * y lo restaura al desmontarse. Pensada para iOS Safari donde
 * `overflow: hidden` solo no alcanza.
 *
 * Uso: agregar `appModalScrollLock` al contenedor del modal
 * que esté dentro de un `*ngIf`.
 */
@Directive({ selector: '[appModalScrollLock]' })
export class ModalScrollLockDirective implements OnInit, OnDestroy {
  private static openCount = 0;

  ngOnInit(): void {
    ModalScrollLockDirective.openCount++;
    if (ModalScrollLockDirective.openCount === 1) {
      document.body.classList.add('ios-modal-open');
    }
  }

  ngOnDestroy(): void {
    ModalScrollLockDirective.openCount--;
    if (ModalScrollLockDirective.openCount <= 0) {
      ModalScrollLockDirective.openCount = 0;
      document.body.classList.remove('ios-modal-open');
    }
  }
}
