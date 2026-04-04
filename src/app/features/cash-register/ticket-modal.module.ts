import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../../shared/shared.module';
import { TicketModalComponent } from './ticket-modal.component';

@NgModule({
  declarations: [TicketModalComponent],
  imports: [CommonModule, SharedModule],
  exports: [TicketModalComponent],
})
export class TicketModalModule {}
