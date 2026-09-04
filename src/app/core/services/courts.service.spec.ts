import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CourtsService } from './courts.service';
import { Court } from '../models/court.model';
import { environment } from '../../../environments/environment';

describe('CourtsService', () => {
  let service: CourtsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/courts`;

  const courtA: Court = { id: 'a', name: 'Cancha A', description: '', isActive: true };
  const courtB: Court = { id: 'b', name: 'Cancha B', description: '', isActive: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CourtsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loadCourts() fetches and pushes the result into courts$', (done) => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA]);

    service.courts$.subscribe((courts) => {
      expect(courts).toEqual([courtA]);
      done();
    });
  });

  it('findAll() hits the server when the local cache is empty', () => {
    service.findAll().subscribe((courts) => expect(courts).toEqual([courtA]));
    httpMock.expectOne(url).flush([courtA]);
  });

  it('findAll() serves from the in-memory subject without a new HTTP call once populated', () => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA]);

    service.findAll().subscribe((courts) => expect(courts).toEqual([courtA]));
    httpMock.expectNone(url);
  });

  it('clearCache() empties the subject so findAll() hits the server again', () => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA]);

    service.clearCache();

    service.findAll().subscribe();
    const secondReq = httpMock.expectOne(url);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush([courtA]);
  });

  it('create() POSTs the dto and inserts the result alphabetically', (done) => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtB]);

    service.create({ name: 'Cancha A' }).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    req.flush(courtA);

    service.courts$.subscribe((courts) => {
      expect(courts.map((c) => c.name)).toEqual(['Cancha A', 'Cancha B']);
      done();
    });
  });

  it('update() PATCHes /courts/:id and replaces the entity in the cache', (done) => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA]);

    const updated = { ...courtA, name: 'Cancha A Renovada' };
    service.update('a', { name: 'Cancha A Renovada' }).subscribe();
    const req = httpMock.expectOne(`${url}/a`);
    expect(req.request.method).toBe('PATCH');
    req.flush(updated);

    service.courts$.subscribe((courts) => {
      expect(courts[0].name).toBe('Cancha A Renovada');
      done();
    });
  });

  it('toggleStatus() applies an optimistic update before the server responds', (done) => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA]);

    service.toggleStatus('a', false).subscribe();

    // Optimistic update happens synchronously, before the HTTP response arrives.
    expect(service['_courts$'].value[0].isActive).toBe(false);

    const req = httpMock.expectOne(`${url}/a`);
    expect(req.request.body).toEqual({ isActive: false });
    req.flush({ ...courtA, isActive: false });

    service.courts$.subscribe((courts) => {
      expect(courts[0].isActive).toBe(false);
      done();
    });
  });

  it('delete() removes the entity from the cache on success', (done) => {
    service.loadCourts();
    httpMock.expectOne(url).flush([courtA, courtB]);

    service.delete('a').subscribe();
    const req = httpMock.expectOne(`${url}/a`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    service.courts$.subscribe((courts) => {
      expect(courts.map((c) => c.id)).toEqual(['b']);
      done();
    });
  });
});
