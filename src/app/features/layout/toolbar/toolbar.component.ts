import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, EMPTY } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  switchMap,
} from 'rxjs/operators';

import { User } from '../../../core/models/user.model';
import { AppNotification } from '../../../core/models/notification.model';
import { BookingResponse } from '../../../core/models/booking.model';
import { AuthService } from '../../../core/services/auth.service';
import { BookingsService } from '../../../core/services/bookings.service';
import { CalculatorService } from '../../../core/services/calculator.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  SearchService,
  SearchResponse,
  SearchResultItem,
} from '../../../core/services/search.service';
import { ThemeService } from '../../../core/services/theme.service';
import { HolidayService } from '../../../core/services/holiday.service';
import { NgIf, NgTemplateOutlet, NgFor, NgClass, AsyncPipe, DecimalPipe, DatePipe } from '@angular/common';
import { TicketModalComponent } from '../../cash-register/ticket-modal.component';

@Component({
    selector: 'app-toolbar',
    templateUrl: './toolbar.component.html',
    imports: [
        NgIf,
        NgTemplateOutlet,
        NgFor,
        NgClass,
        TicketModalComponent,
        AsyncPipe,
        DecimalPipe,
        DatePipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent implements OnInit, OnDestroy {
  @Input() title = '';
  @Input() currentUser: User | null = null;
  @Output() toggleMenu = new EventEmitter<void>();

  isNotifOpen = signal(false);
  isUserMenuOpen = signal(false);
  isDepositsOpen = signal(false);

  notifications = signal<AppNotification[]>([]);

  pendingDeposits = signal<BookingResponse[]>([]);
  isLoadingDeposits = signal(false);
  confirmingDepositId = signal<string | null>(null);

  searchQuery = signal('');
  isSearchOpen = signal(false);
  isSearchLoading = signal(false);
  searchResults = signal<SearchResponse>({ products: [], bookings: [], sales: [] });

  /** Controla si el buscador expandido está activo en mobile. */
  isMobileSearchOpen = signal(false);

  /** ID de la venta cuyo ticket debe mostrarse sobre la pantalla actual. */
  globalTicketSaleId = signal<string | null>(null);

  private readonly searchSubject = new Subject<string>();
  private sub = new Subscription();

  constructor(
    public calcService: CalculatorService,
    public themeService: ThemeService,
    public holidayService: HolidayService,
    private router: Router,
    public authService: AuthService,
    private notificationService: NotificationService,
    private searchService: SearchService,
    private bookingsService: BookingsService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.notificationService.notifications$.subscribe((notifs) => {
        this.notifications.set(notifs);
      }),
    );

    if (this.authService.isAdmin) {
      this.loadPendingDeposits();
    }

    this.sub.add(
      this.searchSubject
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          switchMap((q) => {
            if (!q.trim()) {
              this.searchResults.set({ products: [], bookings: [], sales: [] });
              this.isSearchOpen.set(false);
              return EMPTY;
            }
            this.isSearchLoading.set(true);
            return this.searchService
              .search(q)
              .pipe(finalize(() => this.isSearchLoading.set(false)));
          }),
        )
        .subscribe({
          next: (results) => {
            this.searchResults.set(results);
            this.isSearchOpen.set(true);
          },
          error: () => {
            this.isSearchLoading.set(false);
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Clase de color de fondo del avatar según el rol: verde para admin, azul para empleado. */
  get avatarColorClass(): string {
    return this.currentUser?.role === 'admin' ? 'bg-emerald-600' : 'bg-indigo-600';
  }

  /** Iniciales del usuario autenticado (máx. 2 letras) para el avatar de la toolbar. */
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

  /** Cantidad de notificaciones no leídas para el badge del ícono de campana. */
  notifCount = computed(() => this.notifications().length);

  /** True si el dropdown de búsqueda tiene al menos un resultado en cualquier categoría. */
  hasSearchResults = computed(() => {
    const results = this.searchResults();
    return (
      results.products.length > 0 ||
      results.bookings.length > 0 ||
      results.sales.length > 0
    );
  });

  /** Notificaciones agrupadas por categoría (TURNOS, STOCK, CAJA, SISTEMA) para el panel desplegable. */
  groupedNotifications = computed(() => {
    const LABELS: Record<string, string> = {
      TURNOS: 'Turnos',
      STOCK: 'Stock',
      CAJA: 'Caja',
      SISTEMA: 'Sistema',
    };
    const map = new Map<string, AppNotification[]>();
    for (const n of this.notifications()) {
      const cat = n.category ?? 'SISTEMA';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(n);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      label: LABELS[category] ?? category,
      items,
    }));
  });

  /** Clase de color del indicador circular por categoría de notificación. */
  categoryDotClass(category: string): string {
    const map: Record<string, string> = {
      TURNOS: 'bg-amber-500',
      STOCK: 'bg-blue-500',
      CAJA: 'bg-emerald-500',
      SISTEMA: 'bg-slate-400',
    };
    return map[category] ?? 'bg-slate-400';
  }

  /** Propaga el valor del input al Subject de búsqueda para el pipeline de debounce. */
  onSearchInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    this.searchSubject.next(q);
  }

  /** Reabre el dropdown si ya hay resultados cuando el input recupera el foco. */
  onSearchFocus(): void {
    if (this.searchQuery().trim() && this.hasSearchResults()) {
      this.isSearchOpen.set(true);
    }
  }

  /** Limpia el input de búsqueda, resetea resultados y cierra el dropdown. */
  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set({ products: [], bookings: [], sales: [] });
    this.isSearchOpen.set(false);
  }

  openMobileSearch(): void {
    this.isMobileSearchOpen.set(true);
    this.isNotifOpen.set(false);
    this.isUserMenuOpen.set(false);
  }

  closeMobileSearch(): void {
    this.isMobileSearchOpen.set(false);
    this.clearSearch();
  }

  /** Navega al catálogo de productos resaltando el ítem seleccionado desde la búsqueda. */
  navigateToProduct(item: SearchResultItem): void {
    this.clearSearch();
    this.router.navigate(['/app/products'], {
      queryParams: { highlight: item.id },
    });
  }

  /** Navega a la agenda en la fecha y reserva indicadas por el resultado de búsqueda. */
  navigateToBooking(item: SearchResultItem): void {
    this.clearSearch();
    this.router.navigate(['/app/schedule'], {
      queryParams: { date: item.date, openBooking: item.id },
    });
  }

  /** Abre el ticket de una venta desde el resultado de búsqueda navegando a reportes. */
  openSaleTicket(item: SearchResultItem): void {
    this.clearSearch();
    this.globalTicketSaleId.set(item.id);
    this.router.navigate(['/app/reports']);
  }

  /** Cierra el overlay de ticket de venta global. */
  closeSaleTicket(): void {
    this.globalTicketSaleId.set(null);
  }

  /** `true` si el admin ya abrió WhatsApp para esta notificación (1er clic realizado). */
  hasClickedWA(notifId: string): boolean {
    return localStorage.getItem(`wa_clicked_${notifId}`) === 'true';
  }

  /** Abre o cierra el panel de notificaciones, cerrando los otros dropdowns. */
  toggleNotif(): void {
    this.isNotifOpen.update((v) => !v);
    if (this.isNotifOpen()) {
      this.isUserMenuOpen.set(false);
      this.isSearchOpen.set(false);
    }
  }

  /** Cierra el panel de notificaciones. */
  closeNotif(): void {
    this.isNotifOpen.set(false);
  }

  /** Elimina una notificación individual sin cerrar el panel. */
  dismissNotification(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.removeById(id);
  }

  /** Elimina todas las notificaciones del panel. */
  clearAllNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.clearAllNotifications();
  }

  /** Navega a la ruta de la notificación; si tiene URL de WhatsApp, la abre en la primera interacción. */
  navigateFromNotification(notif: AppNotification): void {
    this.isNotifOpen.set(false);

    if (notif.whatsappUrl) {
      const clickedKey = `wa_clicked_${notif.id}`;
      const alreadyClicked = localStorage.getItem(clickedKey) === 'true';

      if (!alreadyClicked) {
        localStorage.setItem(clickedKey, 'true');
        window.open(notif.whatsappUrl, '_blank');
        return;
      }

      this.router.navigate(notif.actionRoute, {
        queryParams: { ...notif.queryParams, _t: Date.now() },
      });
      return;
    }

    this.router.navigate(
      notif.actionRoute,
      notif.queryParams ? { queryParams: notif.queryParams } : undefined,
    );
  }

  /** Cierra el menú de usuario y navega a la página de perfil. */
  goToAccount(): void {
    this.isUserMenuOpen.set(false);
    this.router.navigate(['/app/account']);
  }

  /** Abre o cierra el menú desplegable del usuario, cerrando los otros paneles. */
  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
    if (this.isUserMenuOpen()) {
      this.isNotifOpen.set(false);
      this.isSearchOpen.set(false);
    }
  }

  /** Cierra el menú desplegable del usuario. */
  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  /** Cierra la sesión y redirige al login. */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  /** Cantidad de señas pendientes para el badge. */
  pendingDepositsCount = computed(() => this.pendingDeposits().length);

  /** Carga (o recarga) la lista de señas pendientes desde la API. */
  loadPendingDeposits(): void {
    this.isLoadingDeposits.set(true);
    this.bookingsService.getPendingExpectedDeposits().subscribe({
      next: (deposits) => {
        this.pendingDeposits.set(deposits);
        this.isLoadingDeposits.set(false);
      },
      error: () => {
        this.isLoadingDeposits.set(false);
      },
    });
  }

  /** Abre o cierra el panel de señas pendientes, cerrando los otros paneles. */
  toggleDeposits(): void {
    this.isDepositsOpen.update((v) => !v);
    if (this.isDepositsOpen()) {
      this.isNotifOpen.set(false);
      this.isUserMenuOpen.set(false);
      this.isSearchOpen.set(false);
      this.loadPendingDeposits();
    }
  }

  /**
   * Confirma una seña pendiente desde el panel del header.
   * Elimina el item de la lista localmente tras confirmar (optimistic UI).
   */
  confirmDeposit(deposit: BookingResponse): void {
    if (this.confirmingDepositId()) return;
    this.confirmingDepositId.set(deposit.id);

    this.bookingsService.confirmExpectedDeposit(deposit.id).subscribe({
      next: () => {
        this.pendingDeposits.update((list) => list.filter((d) => d.id !== deposit.id));
        this.confirmingDepositId.set(null);
      },
      error: () => {
        this.confirmingDepositId.set(null);
      },
    });
  }

  /** Navega a la agenda en la fecha del depósito pendiente. */
  navigateToDeposit(deposit: BookingResponse): void {
    this.isDepositsOpen.set(false);
    this.router.navigate(['/app/schedule'], {
      queryParams: { date: deposit.date, openBooking: deposit.id },
    });
  }

  @HostListener('document:click')
  /** Cierra todos los paneles desplegables al hacer clic fuera de ellos. */
  onDocumentClick(): void {
    this.isUserMenuOpen.set(false);
    this.isNotifOpen.set(false);
    this.isDepositsOpen.set(false);
    this.isSearchOpen.set(false);
    this.isMobileSearchOpen.set(false);
    this.clearSearch();
  }
}
