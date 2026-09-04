import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ConfigService, ConfigEntry } from './config.service';
import { environment } from '../../../environments/environment';

describe('ConfigService', () => {
  let service: ConfigService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/config`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll() issues a single GET even when subscribed twice (shareReplay cache)', () => {
    const entries: ConfigEntry[] = [{ key: 'precio_estandar', value: '3000' }];

    service.getAll().subscribe((res) => expect(res).toEqual(entries));
    service.getAll().subscribe((res) => expect(res).toEqual(entries));

    const req = httpMock.expectOne(url);
    req.flush(entries);
  });

  it('clearCache() forces a fresh GET on the next call', () => {
    const entries: ConfigEntry[] = [{ key: 'precio_estandar', value: '3000' }];

    service.getAll().subscribe();
    httpMock.expectOne(url).flush(entries);

    service.clearCache();

    service.getAll().subscribe();
    const secondReq = httpMock.expectOne(url);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush(entries);
  });

  it('updateBulk() PUTs a configs map built from the entries and invalidates the cache', () => {
    service.getAll().subscribe();
    httpMock.expectOne(url).flush([{ key: 'a', value: '1' }]);

    service
      .updateBulk([
        { key: 'precio_estandar', value: '3500' },
        { key: 'precio_profesor', value: '3000' },
      ])
      .subscribe();

    const putReq = httpMock.expectOne(`${url}/bulk`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({
      configs: { precio_estandar: '3500', precio_profesor: '3000' },
    });
    putReq.flush([]);

    // Cache was cleared by updateBulk(), so this triggers a brand-new GET.
    service.getAll().subscribe();
    httpMock.expectOne(url).flush([{ key: 'a', value: '1' }]);
  });
});
