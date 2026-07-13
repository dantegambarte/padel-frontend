import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LayoutRoutingModule } from './layout-routing.module';
import { LayoutComponent } from './layout.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { SharedModule } from '../../shared/shared.module';
import { TicketModalModule } from '../cash-register/ticket-modal.module';

@NgModule({
    imports: [CommonModule, LayoutRoutingModule, SharedModule, TicketModalModule, LayoutComponent, SidebarComponent, ToolbarComponent],
    providers: [],
})
export class LayoutModule {}
