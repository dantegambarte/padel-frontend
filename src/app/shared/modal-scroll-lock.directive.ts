import { Directive, OnInit, OnDestroy } from '@angular/core';

/**
 * Bloquea el scroll del body y del contenedor scrollable principal
 * cuando un modal se monta y lo restaura al desmontarse.
 *
 * En iOS Safari no alcanza con `overflow: hidden`: el body puede seguir
 * haciendo rubber-band y un contenedor interno (`<main overflow-y-auto>`)
 * sigue scrolleando. Guardamos la posición de scroll, la inmovilizamos con
 * `position: fixed; top: -scrollY` y la restauramos al cerrar el modal.
 *
 * Uso: agregar `appModalScrollLock` al contenedor del modal dentro de un `*ngIf`.
 */
@Directive({ selector: '[appModalScrollLock]' })
export class ModalScrollLockDirective implements OnInit, OnDestroy {
  private static openCount = 0;
  private static savedBodyScrollY = 0;
  private static savedMainScrollTop = 0;
  private static lockedMain: HTMLElement | null = null;

  ngOnInit(): void {
    ModalScrollLockDirective.openCount++;
    if (ModalScrollLockDirective.openCount !== 1) return;

    const body = document.body;
    const html = document.documentElement;

    // 1) Guardamos el scroll del window (en iOS el "scroll" puede caer en el html
    // o en un contenedor interno según cómo esté montado el layout).
    ModalScrollLockDirective.savedBodyScrollY =
      window.scrollY || html.scrollTop || body.scrollTop || 0;

    // 2) Guardamos y bloqueamos el scroll del <main> (layout principal con
    // overflow-y-auto) para evitar que siga scrolleando por debajo del modal.
    const main = document.querySelector('main') as HTMLElement | null;
    if (main) {
      ModalScrollLockDirective.savedMainScrollTop = main.scrollTop;
      ModalScrollLockDirective.lockedMain = main;
      main.style.overflow = 'hidden';
      main.style.touchAction = 'none';
    }

    // 3) Congelamos el body en su posición actual. El `top` negativo evita
    // el "salto al tope" que produce `position: fixed` en iOS.
    body.style.position = 'fixed';
    body.style.top = `-${ModalScrollLockDirective.savedBodyScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    body.classList.add('ios-modal-open');
  }

  ngOnDestroy(): void {
    ModalScrollLockDirective.openCount--;
    if (ModalScrollLockDirective.openCount > 0) return;
    ModalScrollLockDirective.openCount = 0;

    const body = document.body;

    body.classList.remove('ios-modal-open');
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';

    // Restauramos el scroll del window exactamente donde estaba.
    window.scrollTo(0, ModalScrollLockDirective.savedBodyScrollY);

    // Restauramos el <main> que habíamos bloqueado.
    const main = ModalScrollLockDirective.lockedMain;
    if (main) {
      main.style.overflow = '';
      main.style.touchAction = '';
      main.scrollTop = ModalScrollLockDirective.savedMainScrollTop;
      ModalScrollLockDirective.lockedMain = null;
    }

    ModalScrollLockDirective.savedBodyScrollY = 0;
    ModalScrollLockDirective.savedMainScrollTop = 0;
  }
}
