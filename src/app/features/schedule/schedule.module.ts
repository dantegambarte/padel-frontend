import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { ScheduleRoutingModule } from './schedule-routing.module';
import { ScheduleComponent } from './schedule.component';


@NgModule({
    imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ScheduleRoutingModule,
    ScheduleComponent,
],
})
export class ScheduleModule {}
