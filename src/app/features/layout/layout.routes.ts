import { Routes } from '@angular/router';

import { LayoutComponent } from './layout.component';
import { adminGuard } from '../../core/guards/admin.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const layoutRoutes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('../dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        data: { title: 'Dashboard' },
      },
      {
        path: 'schedule',
        loadComponent: () =>
          import('../schedule/schedule.component').then(
            (m) => m.ScheduleComponent,
          ),
        data: { title: 'Schedule' },
      },
      {
        path: 'cash-register',
        loadComponent: () =>
          import('../cash-register/cash-register.component').then(
            (m) => m.CashRegisterComponent,
          ),
        data: { title: 'Cash Register' },
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('../pos/pos.component').then((m) => m.PosComponent),
        data: { title: 'New Sale (Point of Sale)' },
      },
      {
        path: 'products',
        loadComponent: () =>
          import('../products/products.component').then(
            (m) => m.ProductsComponent,
          ),
        data: { title: 'Products / Stock' },
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('../reports/reports.component').then(
            (m) => m.ReportsComponent,
          ),
        canActivate: [adminGuard],
        data: { title: 'Reports', roles: ['admin'] },
      },
      {
        path: 'users',
        loadComponent: () =>
          import('../users/users.component').then((m) => m.UsersComponent),
        canActivate: [adminGuard],
        data: { title: 'Users', roles: ['admin'] },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('../settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
        canActivate: [adminGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { title: 'Settings', roles: ['admin'] },
      },
      {
        path: 'fixed-bookings',
        loadComponent: () =>
          import('../fixed-bookings/fixed-bookings.component').then(
            (m) => m.FixedBookingsComponent,
          ),
        canActivate: [adminGuard],
        data: { title: 'Turnos Fijos', roles: ['admin'] },
      },
      {
        path: 'teachers',
        canActivate: [adminGuard],
        data: { title: 'Profesores', roles: ['admin', 'employee'] },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../teachers/teachers.component').then(
                (m) => m.TeachersComponent,
              ),
            canDeactivate: [unsavedChangesGuard],
          },
          {
            path: 'report',
            loadComponent: () =>
              import('../teachers/teacher-report/teacher-report.component').then(
                (m) => m.TeacherReportComponent,
              ),
            canActivate: [adminGuard],
            data: { roles: ['admin', 'employee'] },
          },
        ],
      },
      {
        path: 'account',
        loadComponent: () =>
          import('../account/account.component').then(
            (m) => m.AccountComponent,
          ),
        data: { title: 'Mi Cuenta' },
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('../expenses/expenses-list/expenses-list.component').then(
            (m) => m.ExpensesListComponent,
          ),
        canActivate: [adminGuard],
        data: { title: 'Egresos', roles: ['admin', 'employee'] },
      },
      {
        path: 'internal-consumption',
        loadComponent: () =>
          import(
            '../internal-consumption/internal-consumption-list/internal-consumption-list.component'
          ).then((m) => m.InternalConsumptionListComponent),
        canActivate: [adminGuard],
        data: { title: 'Consumo Interno', roles: ['admin', 'employee'] },
      },
      {
        path: 'inventory',
        canActivate: [adminGuard],
        data: { title: 'Stock Bajo', roles: ['admin'] },
        children: [
          {
            path: 'alerts',
            loadComponent: () =>
              import('../inventory/inventory-alerts/inventory-alerts.component').then(
                (m) => m.InventoryAlertsComponent,
              ),
            canActivate: [adminGuard],
            data: { roles: ['admin'] },
          },
          { path: '', redirectTo: 'alerts', pathMatch: 'full' },
        ],
      },
      {
        path: 'pricing-shifts',
        loadComponent: () =>
          import('../pricing-shifts/pricing-shifts.component').then(
            (m) => m.PricingShiftsComponent,
          ),
        canActivate: [adminGuard],
        data: { title: 'Franjas Horarias', roles: ['admin'] },
      },
    ],
  },
];
