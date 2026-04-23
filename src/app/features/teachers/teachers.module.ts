import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { TeacherReportComponent } from './teacher-report/teacher-report.component';
import { TeacherSettlementModalComponent } from './teacher-report/teacher-settlement-modal.component';
import { TeachersRoutingModule } from './teachers-routing.module';
import { TeachersComponent } from './teachers.component';

@NgModule({
  declarations: [
    TeachersComponent,
    TeacherReportComponent,
    TeacherSettlementModalComponent,
  ],
  imports: [CommonModule, FormsModule, SharedModule, TeachersRoutingModule],
})
export class TeachersModule {}
