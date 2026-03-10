import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/user.model';

interface NavItem {
  id: string;
  label: string;
  icon: string;      // Nombre del SVG inline (ver template)
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  currentUrl = '';
  isUserMenuOpen = false;

  private sub = new Subscription();

  readonly allNavItems: NavItem[] = [
    { id: 'dashboard',      label: 'Dashboard',              icon: 'layout-dashboard', route: '/app/dashboard',      roles: ['admin', 'employee'] },
    { id: 'schedule',       label: 'Schedule',               icon: 'calendar-check',   route: '/app/schedule',       roles: ['admin', 'employee'] },
    { id: 'cash-register',  label: 'Cash Register',          icon: 'credit-card',      route: '/app/cash-register',  roles: ['admin', 'employee'] },
    { id: 'pos',            label: 'New Sale (POS)',          icon: 'shopping-cart',    route: '/app/pos',            roles: ['admin', 'employee'] },
    { id: 'products',       label: 'Products',               icon: 'package',          route: '/app/products',       roles: ['admin', 'employee'] },
    { id: 'reports',        label: 'Financial Reports',      icon: 'bar-chart',        route: '/app/reports',        roles: ['admin'] },
    { id: 'settings',       label: 'Settings',               icon: 'settings',         route: '/app/settings',       roles: ['admin'] },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private elRef: ElementRef,
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
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
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
  }

  logout(): void {
    this.isUserMenuOpen = false;
    this.authService.logout();
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  /** Cierra el dropdown si el click fue fuera del sidebar. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isUserMenuOpen = false;
    }
  }
}
