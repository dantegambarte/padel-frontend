import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CashService } from './cash.service';
import { ConfigService } from './config.service';
import { CourtsService } from './courts.service';
import { FixedBookingsService } from './fixed-bookings.service';
import { NotificationService } from './notification.service';
import { ProductsService } from './products.service';
import { ReportsService } from './reports.service';
import { TeachersService } from './teachers.service';
import { UsersService } from './users.service';
import { AuthResponse, User } from '../models/user.model';
import { environment } from '../../../environments/environment';

const LEGACY_ACCESS_KEY = 'padelsys_access_token';
const LEGACY_REFRESH_KEY = 'padelsys_refresh_token';
const USER_KEY = 'padelsys_user';
const NOTIFICATIONS_KEY = 'caldera_notifications';

/** Builds a base64url JWT-shaped string with the given payload (signature is a dummy). */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.dummysignature`;
}

const mockUser: User = {
  id: 'u1',
  username: 'admin',
  fullName: 'Admin',
  role: 'admin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  const url = `${environment.apiUrl}/auth`;

  const clearCacheSpies: Record<string, jasmine.Spy> = {};

  function makeServiceSpy<T extends object>(methods: string[]): jasmine.SpyObj<T> {
    return jasmine.createSpyObj('svc', methods) as jasmine.SpyObj<T>;
  }

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    const cashSpy = makeServiceSpy<CashService>(['clearCurrentCache']);
    const configSpy = makeServiceSpy<ConfigService>(['clearCache']);
    const courtsSpy = makeServiceSpy<CourtsService>(['clearCache']);
    const fixedBookingsSpy = makeServiceSpy<FixedBookingsService>(['clearCache']);
    const notificationSpy = makeServiceSpy<NotificationService>(['clearAllNotifications']);
    const productsSpy = makeServiceSpy<ProductsService>(['clearCache']);
    const reportsSpy = makeServiceSpy<ReportsService>(['clearCache']);
    const teachersSpy = makeServiceSpy<TeachersService>(['clearCache']);
    const usersSpy = makeServiceSpy<UsersService>(['clearCache']);

    Object.assign(clearCacheSpies, {
      cash: cashSpy.clearCurrentCache,
      config: configSpy.clearCache,
      courts: courtsSpy.clearCache,
      fixedBookings: fixedBookingsSpy.clearCache,
      notification: notificationSpy.clearAllNotifications,
      products: productsSpy.clearCache,
      reports: reportsSpy.clearCache,
      teachers: teachersSpy.clearCache,
      users: usersSpy.clearCache,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: CashService, useValue: cashSpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: CourtsService, useValue: courtsSpy },
        { provide: FixedBookingsService, useValue: fixedBookingsSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ProductsService, useValue: productsSpy },
        { provide: ReportsService, useValue: reportsSpy },
        { provide: TeachersService, useValue: teachersSpy },
        { provide: UsersService, useValue: usersSpy },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  const validJwt = () => makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });

  /** Logs in through the public API so the in-memory access token is set. */
  function loginWith(accessToken: string, user: User = mockUser): void {
    service.login({ username: user.username, password: 'secret' }).subscribe();
    httpMock.expectOne(`${url}/login`).flush({ accessToken, user } as AuthResponse);
  }

  describe('construction / loadUserFromStorage', () => {
    it('starts logged out when nothing is persisted', () => {
      service = TestBed.inject(AuthService);
      expect(service.isLoggedIn).toBe(false);
      expect(service.currentUser).toBeNull();
    });

    it('restores the stored user profile but no access token until restoreSession()', () => {
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

      service = TestBed.inject(AuthService);
      expect(service.currentUser).toEqual(mockUser);
      expect(service.getAccessToken()).toBeNull();
    });

    it('removes the legacy token keys left by older builds', () => {
      localStorage.setItem(LEGACY_ACCESS_KEY, 'old-access');
      localStorage.setItem(LEGACY_REFRESH_KEY, 'old-refresh');

      service = TestBed.inject(AuthService);
      expect(localStorage.getItem(LEGACY_ACCESS_KEY)).toBeNull();
      expect(localStorage.getItem(LEGACY_REFRESH_KEY)).toBeNull();
      expect(service.getAccessToken()).toBeNull();
    });

    it('stays logged out and does not throw when the stored user JSON is malformed', () => {
      localStorage.setItem(USER_KEY, '{not valid json');

      service = TestBed.inject(AuthService);
      expect(service.currentUser).toBeNull();
    });
  });

  describe('restoreSession()', () => {
    it('does not call the server when no user is stored', (done) => {
      service = TestBed.inject(AuthService);
      service.restoreSession().subscribe(() => {
        httpMock.expectNone(`${url}/refresh`);
        expect(service.isLoggedIn).toBe(false);
        done();
      });
    });

    it('trades the refresh cookie for an in-memory access token', (done) => {
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      service = TestBed.inject(AuthService);
      const token = validJwt();

      service.restoreSession().subscribe(() => {
        expect(service.getAccessToken()).toBe(token);
        expect(service.currentUser).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne(`${url}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toBeNull();
      req.flush({ accessToken: token });
    });

    it('clears the local session without navigating or erroring when the cookie is rejected', (done) => {
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      localStorage.setItem(NOTIFICATIONS_KEY, '[]');
      service = TestBed.inject(AuthService);

      service.restoreSession().subscribe({
        next: () => {
          expect(service.isLoggedIn).toBe(false);
          expect(service.getAccessToken()).toBeNull();
          expect(localStorage.getItem(USER_KEY)).toBeNull();
          expect(localStorage.getItem(NOTIFICATIONS_KEY)).toBeNull();
          expect(routerSpy.navigate).not.toHaveBeenCalled();
          done();
        },
        error: () => fail('restoreSession must not error'),
      });

      httpMock
        .expectOne(`${url}/refresh`)
        .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('isTokenExpired()', () => {
    it('treats a missing token as expired', () => {
      service = TestBed.inject(AuthService);
      expect(service.isTokenExpired()).toBe(true);
    });

    it('treats a token with a future exp as valid', () => {
      service = TestBed.inject(AuthService);
      loginWith(validJwt());
      expect(service.isTokenExpired()).toBe(false);
    });

    it('treats a token with a past exp as expired', () => {
      service = TestBed.inject(AuthService);
      loginWith(makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 }));
      expect(service.isTokenExpired()).toBe(true);
    });

    it('treats a malformed token as expired instead of throwing', () => {
      service = TestBed.inject(AuthService);
      loginWith('not-a-jwt');
      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('login()', () => {
    const credentials = { username: 'admin', password: 'secret' };

    it('POSTs the credentials with credentials mode and keeps the token only in memory', (done) => {
      service = TestBed.inject(AuthService);
      const response: AuthResponse = { accessToken: validJwt(), user: mockUser };

      service.login(credentials).subscribe((res) => {
        expect(res).toEqual(response);
        expect(service.getAccessToken()).toBe(response.accessToken);
        expect(localStorage.getItem(LEGACY_ACCESS_KEY)).toBeNull();
        expect(localStorage.getItem(LEGACY_REFRESH_KEY)).toBeNull();
        expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(mockUser);
        expect(service.currentUser).toEqual(mockUser);
        expect(service.isLoggedIn).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${url}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual(credentials);
      req.flush(response);
    });

    it('never writes any token to localStorage', () => {
      service = TestBed.inject(AuthService);
      loginWith(validJwt());
      const stored = Object.keys(localStorage).map((k) => localStorage.getItem(k));
      expect(stored.some((v) => v?.includes('.dummysignature'))).toBe(false);
    });
  });

  describe('refresh()', () => {
    it('POSTs with credentials and no body, and keeps the new access token in memory', (done) => {
      service = TestBed.inject(AuthService);
      const token = validJwt();

      service.refresh().subscribe((res) => {
        expect(res).toEqual({ accessToken: token });
        expect(service.getAccessToken()).toBe(token);
        done();
      });

      const req = httpMock.expectOne(`${url}/refresh`);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toBeNull();
      req.flush({ accessToken: token });
    });

    it('logs out and rethrows when the refresh request fails', (done) => {
      service = TestBed.inject(AuthService);
      const token = validJwt();
      loginWith(token);

      service.refresh().subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
          expect(service.isLoggedIn).toBe(false);
          expect(service.getAccessToken()).toBeNull();
          expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
          done();
        },
      });

      httpMock
        .expectOne(`${url}/refresh`)
        .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
      httpMock.expectOne(`${url}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('logout()', () => {
    it('clears the session state, resets currentUser and redirects to login', () => {
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      localStorage.setItem(NOTIFICATIONS_KEY, '[]');
      service = TestBed.inject(AuthService);

      service.logout();
      // No access token in memory yet: nothing to revoke on the server.
      httpMock.expectNone(`${url}/logout`);

      expect(service.getAccessToken()).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
      expect(localStorage.getItem(NOTIFICATIONS_KEY)).toBeNull();
      expect(service.currentUser).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('revokes the session on the server with the in-memory token and credentials', () => {
      service = TestBed.inject(AuthService);
      loginWith('token');

      service.logout();

      const req = httpMock.expectOne(`${url}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer token');
      // Needed so the response can clear the HttpOnly refresh cookie.
      expect(req.request.withCredentials).toBe(true);
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(service.getAccessToken()).toBeNull();
    });

    it('logs out locally even when the server call fails', () => {
      service = TestBed.inject(AuthService);
      loginWith('token');

      service.logout();
      httpMock
        .expectOne(`${url}/logout`)
        .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(service.getAccessToken()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('does not call the server when there is no access token', () => {
      service = TestBed.inject(AuthService);
      service.logout();
      httpMock.expectNone(`${url}/logout`);
    });

    it('clears the cache of every dependent service (avoids stale data across users)', () => {
      service = TestBed.inject(AuthService);
      service.logout();
      Object.values(clearCacheSpies).forEach((spy) => expect(spy).toHaveBeenCalled());
    });

    it('is idempotent — calling it twice does not throw', () => {
      service = TestBed.inject(AuthService);
      expect(() => {
        service.logout();
        service.logout();
      }).not.toThrow();
    });
  });

  describe('getAccessToken()', () => {
    it('returns null when there is no session', () => {
      service = TestBed.inject(AuthService);
      expect(service.getAccessToken()).toBeNull();
    });

    it('ignores a token left in localStorage by an older build', () => {
      localStorage.setItem(LEGACY_ACCESS_KEY, 'access-1');
      service = TestBed.inject(AuthService);
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('isAdmin', () => {
    it('is false when logged out', () => {
      service = TestBed.inject(AuthService);
      expect(service.isAdmin).toBe(false);
    });

    it('is true when the current user has the admin role', (done) => {
      service = TestBed.inject(AuthService);
      const response: AuthResponse = {
        accessToken: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: mockUser,
      };
      service.login({ username: 'admin', password: 'secret' }).subscribe(() => {
        expect(service.isAdmin).toBe(true);
        done();
      });
      httpMock.expectOne(`${url}/login`).flush(response);
    });

    it('is false when the current user is an employee', (done) => {
      service = TestBed.inject(AuthService);
      const employee: User = { ...mockUser, role: 'employee' };
      const response: AuthResponse = {
        accessToken: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        user: employee,
      };
      service.login({ username: 'emp', password: 'secret' }).subscribe(() => {
        expect(service.isAdmin).toBe(false);
        done();
      });
      httpMock.expectOne(`${url}/login`).flush(response);
    });
  });

  describe('changeOwnPassword()', () => {
    it('PATCHes /auth/me/password and clears mustChangePassword on the stored user', (done) => {
      const loggedInUser: User = { ...mockUser, mustChangePassword: true };
      localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
      const fresh = TestBed.inject(AuthService);

      fresh.changeOwnPassword('old', 'new').subscribe((res) => {
        expect(res).toEqual({ success: true, message: 'ok' });
        expect(fresh.currentUser?.mustChangePassword).toBe(false);
        expect(JSON.parse(localStorage.getItem(USER_KEY)!).mustChangePassword).toBe(false);
        done();
      });

      const req = httpMock.expectOne(`${url}/me/password`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ currentPassword: 'old', newPassword: 'new' });
      req.flush({ success: true, message: 'ok' });
    });

    it('does not touch storage when there is no current user', (done) => {
      service = TestBed.inject(AuthService);
      service.changeOwnPassword('old', 'new').subscribe((res) => {
        expect(res).toEqual({ success: true, message: 'ok' });
        expect(localStorage.getItem(USER_KEY)).toBeNull();
        done();
      });
      httpMock
        .expectOne(`${url}/me/password`)
        .flush({ success: true, message: 'ok' });
    });
  });
});
