import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutComponent } from './layout.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Fase 1–9 (lazy-loaded) ───────────────────────────────────────────
      {
        path: 'dashboard',
        loadChildren: () => import('../dashboard/dashboard.module').then(m => m.DashboardModule),
        data: { title: 'Dashboard' },
      },
      {
        path: 'schedule',
        loadChildren: () => import('../schedule/schedule.module').then(m => m.ScheduleModule),
        data: { title: 'Schedule' },
      },
      {
        path: 'cash-register',
        loadChildren: () => import('../cash-register/cash-register.module').then(m => m.CashRegisterModule),
        data: { title: 'Cash Register' },
      },
      {
        path: 'pos',
        loadChildren: () => import('../pos/pos.module').then(m => m.PosModule),
        data: { title: 'New Sale (Point of Sale)' },
      },
      {
        path: 'products',
        loadChildren: () => import('../products/products.module').then(m => m.ProductsModule),
        data: { title: 'Products / Stock' },
      },
      {
        path: 'reports',
        loadChildren: () => import('../reports/reports.module').then(m => m.ReportsModule),
        data: { title: 'Reports' },
      },
      {
        path: 'users',
        loadChildren: () => import('../users/users.module').then(m => m.UsersModule),
        data: { title: 'Users' },
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsModule),
        data: { title: 'Settings' },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutRoutingModule {}
