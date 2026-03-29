import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  tap,
  catchError,
  throwError,
} from 'rxjs';

import { AuthResponse, LoginCredentials, User } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { ConfigService } from './config.service';
import { CourtsService } from './courts.service';
import { FixedBookingsService } from './fixed-bookings.service';
import { NotificationService } from './notification.service';
import { ProductsService } from './products.service';
import { TeachersService } from './teachers.service';
import { UsersService } from './users.service';

const TOKEN_KEY = 'padelsys_access_token';
const REFRESH_KEY = 'padelsys_refresh_token';
const USER_KEY = 'padelsys_user';
/** Clave de notificaciones persistidas. Debe limpiarse al cerrar sesión. */
const NOTIFICATIONS_KEY = 'caldera_notifications';

/**
 * Servicio responsable de la gestión del estado de autenticación.
 *
 * Persiste los tokens y el usuario actual en `localStorage` para que la sesión
 * sobreviva una recarga completa de la página. Expone un stream reactivo (`currentUser$`)
 * al que los componentes y guards pueden suscribirse para reaccionar a eventos de login/logout.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(
    this.loadUserFromStorage(),
  );

  /**
   * Stream observable del usuario autenticado actualmente.
   * Emite `null` cuando no hay sesión activa.
   */
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private configService: ConfigService,
    private courtsService: CourtsService,
    private fixedBookingsService: FixedBookingsService,
    private notificationService: NotificationService,
    private productsService: ProductsService,
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
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((response) => this.persistSession(response)));
  }

  /**
   * Solicita un nuevo access token usando el refresh token almacenado.
   * Es llamado automáticamente por {@link JwtInterceptor} ante respuestas 401.
   * Dispara el logout cuando el refresh token expiró.
   */
  refresh(): Observable<AuthResponse> {
    const token = this.getRefreshToken();
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken: token })
      .pipe(
        tap((response) => this.persistSession(response)),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        }),
      );
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
    // ── Tokens y perfil ──────────────────────────────────────────────────────
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    // ── Estado persistido de otras features ──────────────────────────────────
    // Notificaciones: pueden contener alertas de turnos retrasados del cajero
    // anterior que no son relevantes para el próximo usuario en este dispositivo.
    localStorage.removeItem(NOTIFICATIONS_KEY);

    // ── Memoria reactiva en el BehaviorSubject ───────────────────────────────
    this.currentUserSubject.next(null);

    // ── Cachés en memoria ────────────────────────────────────────────────────
    // Evita que datos de la sesión anterior sean servidos a un usuario diferente
    // antes de que cada caché se invalide sola por mutación.
    this.configService.clearCache();
    this.courtsService.clearCache();
    this.fixedBookingsService.clearCache();
    this.productsService.clearCache();
    this.teachersService.clearCache();
    this.usersService.clearCache();
    this.notificationService.clearAllNotifications();

    this.router.navigate(['/auth/login']);
  }

  /** Devuelve el access token almacenado, o `null` si no hay ninguno. */
  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Devuelve el refresh token almacenado, o `null` si no hay ninguno. */
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
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
      .patch<{ success: boolean; message: string }>(`${this.apiUrl}/me/password`, {
        currentPassword,
        newPassword,
      })
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
   * Persiste los tokens de autenticación y los datos del usuario en `localStorage`
   * y actualiza el subject reactivo del usuario.
   */
  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
  }

  /**
   * Intenta leer el objeto usuario desde `localStorage`.
   * Devuelve `null` cuando:
   * - el valor almacenado está ausente o tiene formato inválido.
   * - el access token JWT ya expiró al momento de iniciar la app.
   *   En ese caso también limpia todas las claves de sesión para evitar
   *   que el guard vea un usuario válido con un token muerto.
   */
  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;

      // Verificar expiración del token ANTES de restaurar el estado.
      // Evita el bug "vista muerta": la sesión persiste en storage pero
      // el token expiró → el guard pasaría, el componente carga sin datos.
      if (this.isTokenExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(NOTIFICATIONS_KEY);
        return null;
      }

      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
