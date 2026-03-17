import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';

/**
 * Top-level application routes.
 *
 * - `/auth/login`  — public zone, lazy-loaded {@link AuthModule}
 * - `/app/**`      — private zone, lazy-loaded {@link LayoutModule}, protected by {@link AuthGuard}
 * - `**`           — catch-all redirect to `/auth/login`
 */
const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then((m) => m.AuthModule),
  },

  {
    path: 'app',
    loadChildren: () =>
      import('./features/layout/layout.module').then((m) => m.LayoutModule),
    canActivate: [AuthGuard],
  },

  { path: '**', redirectTo: '/auth/login' },
];

/**
 * Application routing module — registers the root-level route table.
 */
@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
