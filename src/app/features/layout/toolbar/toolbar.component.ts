import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { User } from '../../../core/models/user.model';
import { AppNotification } from '../../../core/models/notification.model';
import { AuthService } from '../../../core/services/auth.service';
import { CalculatorService } from '../../../core/services/calculator.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SearchService, SearchResponse, SearchResultItem } from '../../../core/services/search.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
})
export class ToolbarComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() currentUser: User | null = null;
  @Output() toggleMenu = new EventEmitter<void>();

  // ── Estado de dropdowns ──────────────────────────────────────────────────
  isNotifOpen = false;
  isUserMenuOpen = false;

  // ── Estado de notificaciones ─────────────────────────────────────────────
  notifications: AppNotification[] = [];

  // ── Estado del buscador ──────────────────────────────────────────────────
  searchQuery = '';
  isSearchOpen = false;
  isSearchLoading = false;
  searchResults: SearchResponse = { products: [], bookings: [], sales: [] };

  private readonly searchSubject = new Subject<string>();
  private sub = new Subscription();

  constructor(
    public calcService: CalculatorService,
    private router: Router,
    public authService: AuthService,
    private notificationService: NotificationService,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    // Suscribirse al stream de notificaciones reactivas
    this.sub.add(
      this.notificationService.notifications$.subscribe((notifs) => {
        this.notifications = notifs;
      }),
    );

    // Pipeline de búsqueda con debounce y deduplicación
    this.sub.add(
      this.searchSubject
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          switchMap((q) => {
            if (!q.trim()) {
              this.searchResults = { products: [], bookings: [], sales: [] };
              this.isSearchOpen = false;
              return EMPTY;
            }
            this.isSearchLoading = true;
            return this.searchService
              .search(q)
              .pipe(finalize(() => (this.isSearchLoading = false)));
          }),
        )
        .subscribe({
          next: (results) => {
            this.searchResults = results;
            this.isSearchOpen = true;
          },
          error: () => {
            this.isSearchLoading = false;
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get userInitials(): string {
    const name = this.currentUser?.fullName ?? '';
    return name
      .trim()
      .split(/\s+/)
      .filter((n) => n.length > 0)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get notifCount(): number {
    return this.notifications.length;
  }

  get hasSearchResults(): boolean {
    return (
      this.searchResults.products.length > 0 ||
      this.searchResults.bookings.length > 0 ||
      this.searchResults.sales.length > 0
    );
  }

  get groupedNotifications(): { category: string; label: string; items: AppNotification[] }[] {
    const LABELS: Record<string, string> = {
      TURNOS: 'Turnos',
      STOCK: 'Stock',
      CAJA: 'Caja',
      SISTEMA: 'Sistema',
    };
    const map = new Map<string, AppNotification[]>();
    for (const n of this.notifications) {
      const cat = n.category ?? 'SISTEMA';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(n);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      label: LABELS[category] ?? category,
      items,
    }));
  }

  categoryDotClass(category: string): string {
    const map: Record<string, string> = {
      TURNOS: 'bg-amber-500',
      STOCK: 'bg-blue-500',
      CAJA: 'bg-emerald-500',
      SISTEMA: 'bg-slate-400',
    };
    return map[category] ?? 'bg-slate-400';
  }

  // ── Buscador ─────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery = q;
    this.searchSubject.next(q);
  }

  onSearchFocus(): void {
    if (this.searchQuery.trim() && this.hasSearchResults) {
      this.isSearchOpen = true;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = { products: [], bookings: [], sales: [] };
    this.isSearchOpen = false;
  }

  navigateToProduct(): void {
    this.clearSearch();
    this.router.navigate(['/app/products']);
  }

  navigateToBooking(item: SearchResultItem): void {
    this.clearSearch();
    this.router.navigate(['/app/schedule'], {
      queryParams: { date: item.date, openBooking: item.id },
    });
  }

  navigateToSale(item: SearchResultItem): void {
    this.clearSearch();
    this.router.navigate(['/app/pos'], {
      queryParams: item.date ? { date: item.date } : undefined,
    });
  }

  // ── Notificaciones ───────────────────────────────────────────────────────

  toggleNotif(): void {
    this.isNotifOpen = !this.isNotifOpen;
    if (this.isNotifOpen) {
      this.isUserMenuOpen = false;
      this.isSearchOpen = false;
    }
  }

  closeNotif(): void {
    this.isNotifOpen = false;
  }

  dismissNotification(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.removeById(id);
  }

  clearAllNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.clearAllNotifications();
  }

  navigateFromNotification(notif: AppNotification): void {
    this.isNotifOpen = false;
    this.router.navigate(
      notif.actionRoute,
      notif.queryParams ? { queryParams: notif.queryParams } : undefined,
    );
  }

  // ── Menú de usuario ──────────────────────────────────────────────────────

  goToAccount(): void {
    this.isUserMenuOpen = false;
    this.router.navigate(['/app/account']);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.isNotifOpen = false;
      this.isSearchOpen = false;
    }
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  // ── Cierre global al hacer clic fuera ────────────────────────────────────

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isUserMenuOpen = false;
    this.isNotifOpen = false;
    this.isSearchOpen = false;
  }
}
