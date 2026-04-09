import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutComponent } from './layout.component';
import { AdminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadChildren: () =>
          import('../dashboard/dashboard.module').then(
            (m) => m.DashboardModule,
          ),
        data: { title: 'Dashboard' },
      },
      {
        path: 'schedule',
        loadChildren: () =>
          import('../schedule/schedule.module').then((m) => m.ScheduleModule),
        data: { title: 'Schedule' },
      },
      {
        path: 'cash-register',
        loadChildren: () =>
          import('../cash-register/cash-register.module').then(
            (m) => m.CashRegisterModule,
          ),
        data: { title: 'Cash Register' },
      },
      {
        path: 'pos',
        loadChildren: () =>
          import('../pos/pos.module').then((m) => m.PosModule),
        data: { title: 'New Sale (Point of Sale)' },
      },
      {
        path: 'products',
        loadChildren: () =>
          import('../products/products.module').then((m) => m.ProductsModule),
        data: { title: 'Products / Stock' },
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('../reports/reports.module').then((m) => m.ReportsModule),
        canActivate: [AdminGuard],
        data: { title: 'Reports', roles: ['admin'] },
      },
      {
        path: 'users',
        loadChildren: () =>
          import('../users/users.module').then((m) => m.UsersModule),
        canActivate: [AdminGuard],
        data: { title: 'Users', roles: ['admin'] },
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../settings/settings.module').then((m) => m.SettingsModule),
        canActivate: [AdminGuard],
        data: { title: 'Settings', roles: ['admin'] },
      },
      {
        path: 'fixed-bookings',
        loadChildren: () =>
          import('../fixed-bookings/fixed-bookings.module').then(
            (m) => m.FixedBookingsModule,
          ),
        canActivate: [AdminGuard],
        data: { title: 'Turnos Fijos', roles: ['admin'] },
      },
      {
        path: 'teachers',
        loadChildren: () =>
          import('../teachers/teachers.module').then((m) => m.TeachersModule),
        canActivate: [AdminGuard],
        data: { title: 'Profesores', roles: ['admin'] },
      },
      {
        path: 'account',
        loadChildren: () =>
          import('../account/account.module').then((m) => m.AccountModule),
        data: { title: 'Mi Cuenta' },
      },

      {
        path: 'expenses',
        loadChildren: () =>
          import('../expenses/expenses.module').then((m) => m.ExpensesModule),
        canActivate: [AdminGuard],
        data: { title: 'Egresos', roles: ['admin'] },
      },

      {
        path: 'inventory',
        loadChildren: () =>
          import('../inventory/inventory.module').then(
            (m) => m.InventoryModule,
          ),
        canActivate: [AdminGuard],
        data: { title: 'Stock Bajo', roles: ['admin'] },
      },

      {
        path: 'pricing-shifts',
        loadChildren: () =>
          import('../pricing-shifts/pricing-shifts.module').then(
            (m) => m.PricingShiftsModule,
          ),
        canActivate: [AdminGuard],
        data: { title: 'Franjas Horarias', roles: ['admin'] },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutRoutingModule {}
