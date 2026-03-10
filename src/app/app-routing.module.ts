import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';

// ─────────────────────────────────────────────────────────────────────────────
//  RUTAS RAÍZ
//
//  Separación entre zona pública y zona privada:
//
//  /auth/login        → LoginComponent       (público, sin AuthGuard)
//  /app/**            → LayoutComponent      (privado, protegido por AuthGuard)
//    /app/dashboard   → DashboardShellComponent
//    /app/schedule      → ScheduleComponent
//    /app/cash-register → CashRegisterComponent
//    /app/pos           → PosComponent
//    /app/products      → ProductsComponent
//    /app/reports       → ReportsComponent
//    /app/settings      → SettingsComponent
//
//  El AuthGuard redirige a /auth/login si no hay sesión activa.
// ─────────────────────────────────────────────────────────────────────────────
const routes: Routes = [
  // Raíz → login
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // Zona pública — lazy loaded
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },

  // Zona privada — lazy loaded, protegida por AuthGuard
  {
    path: 'app',
    loadChildren: () =>
      import('./features/layout/layout.module').then((m) => m.LayoutModule),
    canActivate: [AuthGuard],
  },

  // Catch-all → login
  { path: '**', redirectTo: '/auth/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
