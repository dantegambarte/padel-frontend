import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../../shared/shared.module';
import { TicketModalComponent } from './ticket-modal.component';

@NgModule({
    imports: [CommonModule, SharedModule, TicketModalComponent],
    exports: [TicketModalComponent],
})
export class TicketModalModule {}
