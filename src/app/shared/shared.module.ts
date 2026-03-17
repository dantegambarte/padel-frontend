import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToastComponent } from './toast/toast.component';
import { CalculatorComponent } from './calculator/calculator.component';
import { ModalScrollLockDirective } from './modal-scroll-lock.directive';

@NgModule({
  declarations: [ToastComponent, CalculatorComponent, ModalScrollLockDirective],
  imports: [CommonModule],
  exports: [ToastComponent, CalculatorComponent, ModalScrollLockDirective],
})
export class SharedModule {}
