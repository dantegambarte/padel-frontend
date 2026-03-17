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

const TOKEN_KEY = 'padelsys_access_token';
const REFRESH_KEY = 'padelsys_refresh_token';
const USER_KEY = 'padelsys_user';

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
  ) {}

  /** Devuelve el usuario autenticado actualmente de forma sincrónica, o `null` si no hay sesión. */
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /** Devuelve `true` cuando hay una sesión de usuario activa. */
  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
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

  /** Limpia la sesión local y redirige al usuario a la página de login. */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
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
   * Devuelve `null` cuando el valor almacenado está ausente o tiene formato inválido.
   */
  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
