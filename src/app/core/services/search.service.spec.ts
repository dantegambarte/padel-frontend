import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SearchService, SearchResponse } from './search.service';
import { environment } from '../../../environments/environment';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/search`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends the trimmed query as the `q` param', () => {
    service.search('  padel  ').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === url && r.params.get('q') === 'padel',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ products: [], bookings: [], sales: [] } as SearchResponse);
  });

  it('returns the response body unchanged', (done) => {
    const mockResponse: SearchResponse = {
      products: [{ id: 'p1', label: 'Pelota' }],
      bookings: [],
      sales: [],
    };
    service.search('pelota').subscribe((res) => {
      expect(res).toEqual(mockResponse);
      done();
    });
    httpMock.expectOne(() => true).flush(mockResponse);
  });
});
