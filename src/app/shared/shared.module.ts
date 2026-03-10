import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToastComponent } from './toast/toast.component';
import { CalculatorComponent } from './calculator/calculator.component';

@NgModule({
  declarations: [ToastComponent, CalculatorComponent],
  imports: [CommonModule],
  exports: [ToastComponent, CalculatorComponent],
})
export class SharedModule {}
