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
import { ProductsService } from '../../../core/services/products.service';
import { User, UserRole } from '../../../core/models/user.model';
import { NgIf, NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    imports: [
        NgIf,
        NgClass,
        NgFor,
        NgSwitch,
        NgSwitchCase,
    ],
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() isOpen: boolean = false;
  @Output() closeMenu = new EventEmitter<void>();

  currentUser: User | null = null;
  currentUrl = '';
  isUserMenuOpen = false;
  lowStockCount = 0;
  outOfStockCount = 0;

  private sub = new Subscription();
  filteredNavGroups: NavGroup[] = [];

  readonly navGroups: NavGroup[] = [
    {
      label: 'Operaciones',
      items: [
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
          id: 'pos',
          label: 'Nueva Venta',
          icon: 'shopping-cart',
          route: '/app/pos',
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
          id: 'expenses',
          label: 'Egresos',
          icon: 'money-off',
          route: '/app/expenses',
          roles: ['admin', 'employee'],
        },
        {
          id: 'internal-consumption',
          label: 'Consumo Interno',
          icon: 'restaurant',
          route: '/app/internal-consumption',
          roles: ['admin', 'employee'],
        },
      ],
    },
    {
      label: 'Gestión',
      items: [
        {
          id: 'fixed-bookings',
          label: 'Turnos Fijos',
          icon: 'repeat',
          route: '/app/fixed-bookings',
          roles: ['admin'],
        },
        {
          id: 'products',
          label: 'Productos',
          icon: 'package',
          route: '/app/products',
          roles: ['admin', 'employee'],
        },
        {
          id: 'inventory-alerts',
          label: 'Stock Bajo',
          icon: 'alert-triangle',
          route: '/app/inventory/alerts',
          roles: ['admin'],
        },
      ],
    },
    {
      label: 'Profesores',
      items: [
        {
          id: 'teachers',
          label: 'Lista',
          icon: 'graduation-cap',
          route: '/app/teachers',
          roles: ['admin'],
        },
        {
          id: 'teachers-report',
          label: 'Liquidación',
          icon: 'receipt',
          route: '/app/teachers/report',
          roles: ['admin', 'employee'],
        },
      ],
    },
    {
      label: 'Administración',
      items: [
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
          id: 'pricing-shifts',
          label: 'Tarifas',
          icon: 'tag',
          route: '/app/pricing-shifts',
          roles: ['admin'],
        },
        {
          id: 'settings',
          label: 'Configuración',
          icon: 'settings',
          route: '/app/settings',
          roles: ['admin'],
        },
      ],
    },
  ];

  /**
   * Handler de click global registrado fuera de la zona Angular.
   * Solo entra a la zona (y dispara change detection) cuando el menú está abierto
   * y el click ocurrió fuera del sidebar, evitando repints innecesarios.
   */
  private readonly documentClickHandler = (event: Event): void => {
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
    private productsService: ProductsService,
    private router: Router,
    private elRef: ElementRef,
    private ngZone: NgZone,
  ) {}

  /**
   * Suscribe al usuario activo y a los eventos de navegación para mantener
   * `currentUrl` sincronizado. Registra el listener de click fuera de la zona Angular.
   */
  ngOnInit(): void {
    this.currentUrl = this.router.url;

    this.sub.add(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
        const role = user?.role;
        this.filteredNavGroups = role
          ? this.navGroups
              .map((group) => ({
                label: group.label,
                items: group.items.filter((item) => item.roles.includes(role)),
              }))
              .filter((group) => group.items.length > 0)
          : [];

        if (user) {
          this.productsService.getLowStock().subscribe({
            next: (list) => {
              this.outOfStockCount = list.filter((p) => p.stock === 0).length;
              this.lowStockCount = list.filter((p) => p.stock > 0).length;
            },
            error: () => {
              this.outOfStockCount = 0;
              this.lowStockCount = 0;
            },
          });
        }
      }),
    );

    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.currentUrl = e.urlAfterRedirects;
        }),
    );

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('click', this.documentClickHandler);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    document.removeEventListener('click', this.documentClickHandler);
  }

  /** Devuelve las dos primeras iniciales del nombre completo del usuario, en mayúsculas. */
  get userInitials(): string {
    const name = this.currentUser?.fullName ?? '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /** Devuelve la etiqueta legible del rol del usuario actual. */
  get roleLabel(): string {
    return this.currentUser?.role === 'admin' ? 'Administrador' : 'Empleado';
  }

  /** Clase de color de fondo del avatar según el rol: verde para admin, azul para empleado. */
  get avatarColorClass(): string {
    return this.currentUser?.role === 'admin'
      ? 'bg-emerald-600'
      : 'bg-indigo-600';
  }

  /**
   * Devuelve `true` si la URL actual coincide exactamente con la ruta del ítem.
   * Se usa comparación exacta para evitar que /app/teachers quede activo
   * cuando la URL es /app/teachers/report (ruta distinta en el nav).
   */
  isActive(route: string): boolean {
    return this.currentUrl.split('?')[0] === route;
  }

  /** Devuelve las clases CSS del ítem de navegación según su estado activo/inactivo. */
  navItemClass(route: string): string {
    return this.isActive(route)
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground';
  }

  /**
   * Navega a la ruta indicada, cierra el menú de usuario y emite el evento de cierre del sidebar.
   * @param route - Ruta de destino.
   */
  navigate(route: string): void {
    this.router.navigate([route]);
    this.isUserMenuOpen = false;
    this.closeMenu.emit();
  }

  /** Cierra el menú de usuario y ejecuta el logout. */
  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
  }

  /**
   * Alterna la visibilidad del menú de usuario.
   * Detiene la propagación para evitar que el handler global lo cierre inmediatamente.
   */
  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }
}
