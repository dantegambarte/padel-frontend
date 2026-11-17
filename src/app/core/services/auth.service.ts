import { computed, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  tap,
  throwError,
} from 'rxjs';

import {
  AuthResponse,
  LoginCredentials,
  RefreshResponse,
  User,
} from '../models/user.model';
import { environment } from '../../../environments/environment';
import { CashService } from './cash.service';
import { ConfigService } from './config.service';
import { CourtsService } from './courts.service';
import { FixedBookingsService } from './fixed-bookings.service';
import { NotificationService } from './notification.service';
import { ProductsService } from './products.service';
import { ReportsService } from './reports.service';
import { TeachersService } from './teachers.service';
import { UsersService } from './users.service';

const USER_KEY = 'padelsys_user';
/**
 * Keys where older builds stored the tokens. Tokens no longer touch storage:
 * the access token lives in memory and the refresh token in an HttpOnly cookie.
 * Removed on startup so an upgraded browser does not keep readable tokens around.
 */
const LEGACY_TOKEN_KEYS = ['padelsys_access_token', 'padelsys_refresh_token'];
/** Clave de notificaciones persistidas. Debe limpiarse al cerrar sesión. */
const NOTIFICATIONS_KEY = 'caldera_notifications';

/**
 * Servicio responsable de la gestión del estado de autenticación.
 *
 * Token storage (issue #68): the access token is kept only in memory and the
 * refresh token travels in an HttpOnly cookie that JavaScript never sees. Only the
 * non-sensitive user profile is kept in `localStorage`, and on startup
 * `restoreSession()` exchanges the cookie for a fresh access token, so a reload
 * keeps the session. Expone un stream reactivo (`currentUser$`)
 * al que los componentes y guards pueden suscribirse para reaccionar a eventos de login/logout.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /** In-memory access token. Never persisted. */
  private readonly accessToken = signal<string | null>(null);

  private currentUserSubject = new BehaviorSubject<User | null>(
    this.loadUserFromStorage(),
  );

  /**
   * Stream observable del usuario autenticado actualmente.
   * Emite `null` cuando no hay sesión activa.
   */
  readonly currentUser$ = this.currentUserSubject.asObservable();

  /**
   * Versión signal de `currentUser$`, para componentes con `ChangeDetectionStrategy.OnPush`
   * que necesitan reaccionar a cambios de sesión originados fuera de su propio árbol
   * (ej. logout disparado desde otro componente, refresh de token).
   */
  readonly currentUserSignal = toSignal(this.currentUser$, {
    initialValue: this.currentUserSubject.value,
  });

  /** Versión signal de `isAdmin`, derivada de `currentUserSignal`. */
  readonly isAdminSignal = computed(
    () => this.currentUserSignal()?.role === 'admin',
  );

  constructor(
    private http: HttpClient,
    private router: Router,
    private cashService: CashService,
    private configService: ConfigService,
    private courtsService: CourtsService,
    private fixedBookingsService: FixedBookingsService,
    private notificationService: NotificationService,
    private productsService: ProductsService,
    private reportsService: ReportsService,
    private teachersService: TeachersService,
    private usersService: UsersService,
  ) {}

  /** Devuelve el usuario autenticado actualmente de forma sincrónica, o `null` si no hay sesión. */
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /** Devuelve `true` cuando hay una sesión de usuario activa. */
  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  /**
   * Devuelve `true` cuando el access token JWT almacenado ya expiró o es inválido.
   * Decodifica el payload base64 del JWT sin dependencias externas y compara
   * el campo `exp` (en segundos) contra el timestamp actual.
   * Un token ausente o malformado se trata siempre como expirado.
   */
  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number'
        ? payload.exp * 1000 < Date.now()
        : true;
    } catch {
      return true;
    }
  }

  /** Devuelve `true` cuando el usuario actual tiene el rol `admin`. */
  get isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  /**
   * Autentica a un usuario con las credenciales dadas.
   * Persiste los tokens recibidos y el usuario en `localStorage` si tiene éxito.
   * @param credentials - Nombre de usuario y contraseña.
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials, {
        withCredentials: true,
      })
      .pipe(tap((response) => this.persistSession(response)));
  }

  /**
   * Restores the session after a page load: if a user profile is stored, trades
   * the HttpOnly refresh cookie for a new access token. Runs once from the app
   * initializer, before the first navigation, so guards see the final state.
   * A failure (no cookie, expired or revoked session, no network) clears the
   * local session without navigating: the guard then redirects to the login.
   * Never errors, so it cannot block the app bootstrap.
   */
  restoreSession(): Observable<void> {
    if (!this.currentUserSubject.value) return of(undefined);
    return this.requestRefresh().pipe(
      map(() => undefined),
      catchError(() => {
        this.clearLocalSession();
        return of(undefined);
      }),
    );
  }

  /**
   * Requests a new access token; the browser sends the HttpOnly refresh cookie.
   * Es llamado automáticamente por `jwtInterceptor` ante respuestas 401.
   * Dispara el logout cuando el refresh token expiró.
   */
  refresh(): Observable<RefreshResponse> {
    return this.requestRefresh().pipe(
      catchError((error) => {
        this.logout();
        return throwError(() => error);
      }),
    );
  }

  private requestRefresh(): Observable<RefreshResponse> {
    return this.http
      .post<RefreshResponse>(`${this.apiUrl}/refresh`, null, {
        withCredentials: true,
      })
      .pipe(tap((response) => this.accessToken.set(response.accessToken)));
  }

  /**
   * Limpia la sesión local, invalida las cachés de datos y redirige al login.
   * Llamado tanto por el usuario (botón logout) como por el interceptor
   * ante sesiones expiradas o sobreescritas.
   *
   * IMPORTANTE: limpiar TODAS las claves de localStorage para evitar que datos
   * de la sesión anterior (notificaciones, estado de caja, etc.) reaparezcan
   * al recargar o cuando otro usuario inicie sesión en el mismo dispositivo.
   * Esta operación es idempotente: llamarla varias veces es seguro.
   */
  logout(): void {
    this.revokeSessionOnServer();

    this.clearLocalSession();

    this.cashService.clearCurrentCache();
    this.configService.clearCache();
    this.courtsService.clearCache();
    this.fixedBookingsService.clearCache();
    this.productsService.clearCache();
    this.reportsService.clearCache();
    this.teachersService.clearCache();
    this.usersService.clearCache();
    this.notificationService.clearAllNotifications();

    this.router.navigate(['/auth/login']);
  }

  /**
   * Pide al backend que invalide la sesión (access y refresh token), así un
   * token copiado deja de servir aunque el navegador ya los haya borrado.
   * Es best-effort: el logout local no espera la respuesta, y un error (sin red,
   * o un token que el servidor ya había invalidado) se ignora.
   * El token se adjunta a mano porque la sesión local se limpia antes de que el
   * interceptor procese la request. `withCredentials` lets the response clear
   * the HttpOnly refresh cookie.
   */
  private revokeSessionOnServer(): void {
    const token = this.getAccessToken();
    if (!token) return;
    this.http
      .post<void>(`${this.apiUrl}/logout`, null, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
      .subscribe({ error: () => undefined });
  }

  /** Returns the in-memory access token, or `null` when there is none. */
  getAccessToken(): string | null {
    return this.accessToken();
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   * Requiere la contraseña actual para verificar identidad.
   * Limpia el flag `mustChangePassword` en el estado local al completar.
   */
  changeOwnPassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .patch<{ success: boolean; message: string }>(
        `${this.apiUrl}/me/password`,
        {
          currentPassword,
          newPassword,
        },
      )
      .pipe(
        tap(() => {
          const user = this.currentUserSubject.value;
          if (user) {
            const updated = { ...user, mustChangePassword: false };
            localStorage.setItem(USER_KEY, JSON.stringify(updated));
            this.currentUserSubject.next(updated);
          }
        }),
      );
  }

  /**
   * Keeps the access token in memory and the (non-sensitive) user profile in
   * `localStorage`, and updates the reactive user subject.
   */
  private persistSession(response: AuthResponse): void {
    this.accessToken.set(response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
  }

  /** Drops the local session state. Idempotent; does not navigate. */
  private clearLocalSession(): void {
    this.accessToken.set(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    this.currentUserSubject.next(null);
  }

  /**
   * Reads the stored user profile and removes the legacy token keys.
   * Returns `null` when the value is missing or malformed. The access token is
   * not available yet: `restoreSession()` obtains it before the first navigation.
   */
  private loadUserFromStorage(): User | null {
    try {
      for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
