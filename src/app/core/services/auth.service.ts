import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  tap,
  catchError,
  throwError,
  filter,
  take,
  switchMap,
} from 'rxjs';

import { AuthResponse, LoginCredentials, User } from '../models/user.model';
import { environment } from '../../../environments/environment';

const TOKEN_KEY   = 'padelsys_access_token';
const REFRESH_KEY = 'padelsys_refresh_token';
const USER_KEY    = 'padelsys_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // ── Fuente de verdad del estado de autenticación ─────────────────────────
  // Se inicializa desde localStorage para preservar la sesión al recargar.
  private currentUserSubject = new BehaviorSubject<User | null>(
    this.loadUserFromStorage(),
  );

  /** Observable público: los componentes se suscriben a este para reaccionar
   *  a cambios de sesión (login / logout / token refresh). */
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  // ── Getters síncronos (para guards y lógica que no necesita Observable) ──

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  get isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  // ── Métodos de sesión ─────────────────────────────────────────────────────

  /**
   * POST /api/v1/auth/login
   * Persiste los tokens y actualiza el BehaviorSubject.
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((response) => this.persistSession(response)));
  }

  /**
   * POST /api/v1/auth/refresh
   * Llamado automáticamente por el interceptor cuando recibe un 401.
   * Si falla (refresh token expirado), hace logout.
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

  /** Limpia la sesión local y redirige al login. */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  // ── Privados ──────────────────────────────────────────────────────────────

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY,   response.accessToken);
    localStorage.setItem(REFRESH_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY,    JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
