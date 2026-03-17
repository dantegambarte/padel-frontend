import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter, map } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Inicio',
  schedule: 'Agenda de Turnos',
  'cash-register': 'Cierre de Caja',
  pos: 'Nueva Venta',
  products: 'Productos',
  reports: 'Reportes',
  users: 'Usuarios',
  settings: 'Configuración',
};

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  currentPageTitle = 'Dashboard';
  isSidebarOpen = false;

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  /**
   * Suscribe al usuario autenticado y actualiza el título de página
   * tanto al cargar como en cada evento de navegación.
   */
  ngOnInit(): void {
    this.sub.add(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
      }),
    );

    this.currentPageTitle = this.resolveTitleFromUrl(this.router.url);

    this.sub.add(
      this.router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
          map((e) => e.urlAfterRedirects),
        )
        .subscribe((url) => {
          this.currentPageTitle = this.resolveTitleFromUrl(url);
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Alterna la visibilidad del sidebar en mobile. */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Extrae el último segmento de la URL y lo mapea al título de página correspondiente.
   * @param url - URL completa de la ruta activa.
   */
  private resolveTitleFromUrl(url: string): string {
    const segments = url.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? 'dashboard';
    return PAGE_TITLES[lastSegment] ?? 'Dashboard';
  }
}
