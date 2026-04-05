import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TeachersRoutingModule } from './teachers-routing.module';
import { TeachersComponent } from './teachers.component';
import { TeacherReportComponent } from './teacher-report/teacher-report.component';

@NgModule({
  declarations: [TeachersComponent, TeacherReportComponent],
  imports: [CommonModule, FormsModule, TeachersRoutingModule],
})
export class TeachersModule {}
