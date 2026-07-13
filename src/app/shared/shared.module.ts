import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { CalculatorComponent } from './calculator/calculator.component';
import { DisableScrollDirective } from './directives/disable-scroll.directive';
import { ModalScrollLockDirective } from './modal-scroll-lock.directive';
import { SessionAlertComponent } from './session-alert/session-alert.component';
import { ToastComponent } from './toast/toast.component';

@NgModule({
    imports: [CommonModule, ToastComponent,
        CalculatorComponent,
        ModalScrollLockDirective,
        SessionAlertComponent,
        DisableScrollDirective],
    exports: [
        ToastComponent,
        CalculatorComponent,
        ModalScrollLockDirective,
        SessionAlertComponent,
        DisableScrollDirective,
    ],
})
export class SharedModule {}
