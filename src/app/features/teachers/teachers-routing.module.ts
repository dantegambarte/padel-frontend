import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TeachersComponent } from './teachers.component';
import { TeacherReportComponent } from './teacher-report/teacher-report.component';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { adminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: TeachersComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'report',
    component: TeacherReportComponent,
    canActivate: [adminGuard],
    data: { roles: ['admin', 'employee'] },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TeachersRoutingModule {}
