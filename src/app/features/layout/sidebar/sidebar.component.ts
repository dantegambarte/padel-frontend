import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnInit,
  OnDestroy,
  Output,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user.model';

interface NavItem {
  id: string;
  label: string;
  icon: string; // Nombre del SVG inline (ver template)
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isOpen: boolean = false;
  @Output() closeMenu = new EventEmitter<void>();

  currentUser: User | null = null;
  currentUrl = '';
  isUserMenuOpen = false;

  private sub = new Subscription();

  readonly allNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Inicio',
      icon: 'layout-dashboard',
      route: '/app/dashboard',
      roles: ['admin', 'employee'],
    },
    {
      id: 'schedule',
      label: 'Agenda de Turnos',
      icon: 'calendar-check',
      route: '/app/schedule',
      roles: ['admin', 'employee'],
    },
    {
      id: 'cash-register',
      label: 'Cierre de Caja',
      icon: 'credit-card',
      route: '/app/cash-register',
      roles: ['admin', 'employee'],
    },
    {
      id: 'pos',
      label: 'Nueva Venta',
      icon: 'shopping-cart',
      route: '/app/pos',
      roles: ['admin', 'employee'],
    },
    {
      id: 'products',
      label: 'Productos',
      icon: 'package',
      route: '/app/products',
      roles: ['admin', 'employee'],
    },
    {
      id: 'reports',
      label: 'Reportes',
      icon: 'bar-chart',
      route: '/app/reports',
      roles: ['admin'],
    },
    {
      id: 'users',
      label: 'Usuarios',
      icon: 'users',
      route: '/app/users',
      roles: ['admin'],
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: 'settings',
      route: '/app/settings',
      roles: ['admin'],
    },
  ];

  /** Referencia al listener para poder removerlo en ngOnDestroy. */
  private readonly documentClickHandler = (event: Event): void => {
    // Solo entra a la zona Angular (y dispara CD) si el menú está abierto
    // y el click fue fuera del sidebar. De lo contrario no hace nada y
    // Angular jamás entera de este evento → sin CD → sin repaint del backdrop-blur.
    if (
      this.isUserMenuOpen &&
      !this.elRef.nativeElement.contains(event.target as Node)
    ) {
      this.ngZone.run(() => {
        this.isUserMenuOpen = false;
      });
    }
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;

    this.sub.add(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
      }),
    );

    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.currentUrl = e.urlAfterRedirects;
        }),
    );

    // Registrar el listener FUERA de la zona Angular para que los clicks
    // que no cambian estado no provoquen ciclos de change detection.
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('click', this.documentClickHandler);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    document.removeEventListener('click', this.documentClickHandler);
  }

  get filteredNavItems(): NavItem[] {
    const role = this.currentUser?.role;
    if (!role) return [];
    return this.allNavItems.filter((item) => item.roles.includes(role));
  }

  get userInitials(): string {
    const name = this.currentUser?.fullName ?? '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get roleLabel(): string {
    return this.currentUser?.role === 'admin' ? 'Administrador' : 'Empleado';
  }

  isActive(route: string): boolean {
    return this.currentUrl.startsWith(route);
  }

  /** Clases dinámicas del ítem de navegación — igual que la lógica condicional del prototipo. */
  navItemClass(route: string): string {
    return this.isActive(route)
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground';
  }

  navigate(route: string): void {
    this.router.navigate([route]);
    this.isUserMenuOpen = false;
    this.closeMenu.emit();
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

}
