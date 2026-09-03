import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent,
          ),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  {
    path: 'app',
    loadChildren: () =>
      import('./features/layout/layout.routes').then((m) => m.layoutRoutes),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
  },

  { path: '**', redirectTo: '/auth/login' },
];
