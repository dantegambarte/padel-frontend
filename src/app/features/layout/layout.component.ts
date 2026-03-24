import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter, map } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CashService } from '../../core/services/cash.service';
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
  account: 'Mi Cuenta',
};

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  currentPageTitle = 'Dashboard';
  isSidebarOpen = false;

  unclosedSessionDate: string | null = null;

  private sub = new Subscription();

  constructor(
    private authService: AuthService,
    private cashService: CashService,
    private router: Router,
  ) {}

  /**
   * Suscribe al usuario autenticado y actualiza el título de página
   * tanto al cargar como en cada evento de navegación.
   * Además verifica si existe una sesión de caja abierta de un día anterior.
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

    this.checkUnclosedSession();
  }

  /** Formatea la fecha YYYY-MM-DD a texto legible en español (ej: "lunes 16 de marzo"). */
  formatUnclosedDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  /** Navega a Cierre de Caja y cierra el modal de advertencia. */
  goToCashRegister(): void {
    this.unclosedSessionDate = null;
    this.router.navigate(['/app/cash-register']);
  }

  /**
   * Consulta la sesión actual y, si está abierta con fecha anterior a hoy,
   * activa el modal de sesión sin cerrar.
   */
  private checkUnclosedSession(): void {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD hora local
    this.sub.add(
      this.cashService.getCurrent().subscribe({
        next: (data) => {
          if (
            !data.isClosed &&
            data.sessionDate &&
            data.sessionDate < todayStr
          ) {
            this.unclosedSessionDate = data.sessionDate;
          }
        },
        error: () => {
          /* silencioso: no bloquear el layout si la consulta falla */
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** `true` cuando la ruta activa es la agenda de turnos. */
  get isSchedulePage(): boolean {
    return this.router.url.includes('/schedule');
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
