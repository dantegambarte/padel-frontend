import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToastComponent } from './toast/toast.component';
import { CalculatorComponent } from './calculator/calculator.component';
import { ModalScrollLockDirective } from './modal-scroll-lock.directive';
import { SessionAlertComponent } from './session-alert/session-alert.component';

@NgModule({
  declarations: [
    ToastComponent,
    CalculatorComponent,
    ModalScrollLockDirective,
    SessionAlertComponent,
  ],
  imports: [CommonModule],
  exports: [
    ToastComponent,
    CalculatorComponent,
    ModalScrollLockDirective,
    SessionAlertComponent,
  ],
})
export class SharedModule {}
