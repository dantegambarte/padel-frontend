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

const TOKEN_KEY = 'padelsys_access_token';
const REFRESH_KEY = 'padelsys_refresh_token';
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

  const clearCacheSpies: { [k: string]: jasmine.Spy } = {};

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

  describe('construction / loadUserFromStorage', () => {
    it('starts logged out when nothing is persisted', () => {
      service = TestBed.inject(AuthService);
      expect(service.isLoggedIn).toBe(false);
      expect(service.currentUser).toBeNull();
    });

    it('restores the user from storage when the token is still valid', () => {
      const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

      service = TestBed.inject(AuthService);
      expect(service.isLoggedIn).toBe(true);
      expect(service.currentUser).toEqual(mockUser);
    });

    it('clears the session and stays logged out when the stored token already expired', () => {
      const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 });
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      localStorage.setItem(REFRESH_KEY, 'refresh');
      localStorage.setItem(NOTIFICATIONS_KEY, '[]');

      service = TestBed.inject(AuthService);
      expect(service.isLoggedIn).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(localStorage.getItem(NOTIFICATIONS_KEY)).toBeNull();
    });

    it('stays logged out and does not throw when the stored user JSON is malformed', () => {
      localStorage.setItem(TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem(USER_KEY, '{not valid json');

      service = TestBed.inject(AuthService);
      expect(service.currentUser).toBeNull();
    });
  });

  describe('isTokenExpired()', () => {
    it('treats a missing token as expired', () => {
      service = TestBed.inject(AuthService);
      expect(service.isTokenExpired()).toBe(true);
    });

    it('treats a token with a future exp as valid', () => {
      localStorage.setItem(
        TOKEN_KEY,
        makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      );
      service = TestBed.inject(AuthService);
      expect(service.isTokenExpired()).toBe(false);
    });

    it('treats a token with a past exp as expired', () => {
      localStorage.setItem(
        TOKEN_KEY,
        makeJwt({ exp: Math.floor(Date.now() / 1000) - 3600 }),
      );
      service = TestBed.inject(AuthService);
      expect(service.isTokenExpired()).toBe(true);
    });

    it('treats a malformed token as expired instead of throwing', () => {
      localStorage.setItem(TOKEN_KEY, 'not-a-jwt');
      service = TestBed.inject(AuthService);
      expect(service.isTokenExpired()).toBe(true);
    });
  });

  describe('login()', () => {
    const credentials = { username: 'admin', password: 'secret' };

    it('POSTs the credentials and persists the session on success', (done) => {
      service = TestBed.inject(AuthService);
      const response: AuthResponse = {
        accessToken: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        refreshToken: 'refresh-token',
        user: mockUser,
      };

      service.login(credentials).subscribe((res) => {
        expect(res).toEqual(response);
        expect(localStorage.getItem(TOKEN_KEY)).toBe(response.accessToken);
        expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-token');
        expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(mockUser);
        expect(service.currentUser).toEqual(mockUser);
        expect(service.isLoggedIn).toBe(true);
        done();
      });

      const req = httpMock.expectOne(`${url}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(response);
    });
  });

  describe('refresh()', () => {
    it('POSTs the stored refresh token and persists the new session', (done) => {
      localStorage.setItem(REFRESH_KEY, 'old-refresh');
      service = TestBed.inject(AuthService);
      const response: AuthResponse = {
        accessToken: makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        refreshToken: 'new-refresh',
        user: mockUser,
      };

      service.refresh().subscribe((res) => {
        expect(res).toEqual(response);
        expect(localStorage.getItem(REFRESH_KEY)).toBe('new-refresh');
        done();
      });

      const req = httpMock.expectOne(`${url}/refresh`);
      expect(req.request.body).toEqual({ refreshToken: 'old-refresh' });
      req.flush(response);
    });

    it('logs out and rethrows when the refresh request fails', (done) => {
      localStorage.setItem(REFRESH_KEY, 'old-refresh');
      localStorage.setItem(TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      service = TestBed.inject(AuthService);

      service.refresh().subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
          expect(service.isLoggedIn).toBe(false);
          expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
          expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
          done();
        },
      });

      httpMock
        .expectOne(`${url}/refresh`)
        .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('logout()', () => {
    it('clears all session storage keys, resets currentUser and redirects to login', () => {
      localStorage.setItem(TOKEN_KEY, 'token');
      localStorage.setItem(REFRESH_KEY, 'refresh');
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      localStorage.setItem(NOTIFICATIONS_KEY, '[]');
      service = TestBed.inject(AuthService);

      service.logout();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
      expect(localStorage.getItem(NOTIFICATIONS_KEY)).toBeNull();
      expect(service.currentUser).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
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

  describe('getAccessToken() / getRefreshToken()', () => {
    it('return null when nothing is stored', () => {
      service = TestBed.inject(AuthService);
      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
    });

    it('return the stored values', () => {
      localStorage.setItem(TOKEN_KEY, 'access-1');
      localStorage.setItem(REFRESH_KEY, 'refresh-1');
      service = TestBed.inject(AuthService);
      expect(service.getAccessToken()).toBe('access-1');
      expect(service.getRefreshToken()).toBe('refresh-1');
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
        refreshToken: 'refresh',
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
        refreshToken: 'refresh',
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
      localStorage.setItem(TOKEN_KEY, makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
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
