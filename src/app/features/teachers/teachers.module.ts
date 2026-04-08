import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedModule } from '../../shared/shared.module';
import { TeachersRoutingModule } from './teachers-routing.module';
import { TeachersComponent } from './teachers.component';
import { TeacherReportComponent } from './teacher-report/teacher-report.component';

@NgModule({
  declarations: [TeachersComponent, TeacherReportComponent],
  imports: [CommonModule, FormsModule, SharedModule, TeachersRoutingModule],
})
export class TeachersModule {}
