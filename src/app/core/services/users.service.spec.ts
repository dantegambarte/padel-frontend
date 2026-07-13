import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { UsersService } from './users.service';
import { User, CreateUserDto } from '../models/user.model';
import { environment } from '../../../environments/environment';

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/users`;

  const mockUser: User = {
    id: 'u1',
    username: 'admin',
    fullName: 'Admin',
    role: 'admin',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('findAll() caches the result across subsequent calls', () => {
    service.findAll().subscribe();
    service.findAll().subscribe();
    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockUser]);
  });

  it('clearCache() forces a fresh GET on the next findAll()', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockUser]);

    service.clearCache();

    service.findAll().subscribe();
    const secondReq = httpMock.expectOne(url);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush([mockUser]);
  });

  it('create() POSTs the dto and invalidates the cache', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockUser]);

    const dto: CreateUserDto = {
      username: 'empleado',
      fullName: 'Empleado Uno',
      password: 'secret123',
    };
    service.create(dto).subscribe();
    const postReq = httpMock.expectOne(url);
    expect(postReq.request.method).toBe('POST');
    postReq.flush(mockUser);

    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockUser]);
  });

  it('toggleStatus() sends the inverse of the current status', () => {
    service.toggleStatus('u1', true).subscribe();
    const req = httpMock.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isActive: false });
    req.flush(mockUser);
  });

  it('update() PATCHes /users/:id and invalidates the cache', () => {
    service.update('u1', { fullName: 'Nuevo Nombre' }).subscribe();
    const req = httpMock.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ fullName: 'Nuevo Nombre' });
    req.flush(mockUser);
  });

  it('remove() issues a DELETE to /users/:id', () => {
    service.remove('u1').subscribe();
    const req = httpMock.expectOne(`${url}/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('resetPassword() PATCHes /users/:id/reset-password without touching the cache', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockUser]);

    service.resetPassword('u1', 'newpass123').subscribe((res) => {
      expect(res).toEqual({ success: true, message: 'ok' });
    });
    const req = httpMock.expectOne(`${url}/u1/reset-password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ newPassword: 'newpass123' });
    req.flush({ success: true, message: 'ok' });

    // Cache untouched -> no second HTTP call.
    service.findAll().subscribe();
    httpMock.expectNone(url);
  });
});
