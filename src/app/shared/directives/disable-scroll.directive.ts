import { Directive, HostListener } from '@angular/core';

@Directive({
  standalone: false,
  selector: '[appDisableScroll]',
})
export class DisableScrollDirective {
  @HostListener('wheel', ['$event'])
  onWheel(event: Event): void {
    event.preventDefault();
  }
}
