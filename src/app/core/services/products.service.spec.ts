import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProductsService } from './products.service';
import { Product, CreateProductDto, LowStockProduct } from '../models/product.model';
import { environment } from '../../../environments/environment';

describe('ProductsService', () => {
  let service: ProductsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/products`;

  const mockProduct: Product = {
    id: 'p1',
    name: 'Gatorade',
    costPrice: 500,
    salePrice: 800,
    stock: 10,
    minStock: 2,
    isFeatured: false,
    isActive: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ProductsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('findAll() caches the full list across subsequent calls', () => {
    service.findAll().subscribe();
    service.findAll().subscribe();
    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockProduct]);
  });

  it('getFeatured() caches independently from findAll()', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockProduct]);

    service.getFeatured().subscribe();
    service.getFeatured().subscribe();
    const reqs = httpMock.match(`${url}/featured`);
    expect(reqs.length).toBe(1);
    reqs[0].flush([mockProduct]);
  });

  it('getCategories() never caches — always issues a GET', () => {
    service.getCategories().subscribe();
    service.getCategories().subscribe();
    const reqs = httpMock.match(`${url}/categories`);
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush([{ id: 'c1', name: 'Bebidas' }]));
  });

  it('createCategory() POSTs the name', () => {
    service.createCategory('Bebidas').subscribe();
    const req = httpMock.expectOne(`${url}/categories`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Bebidas' });
    req.flush({ id: 'c1', name: 'Bebidas' });
  });

  it('search() sends the term as the `search` query param, uncached', () => {
    service.search('gato').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === url && r.params.get('search') === 'gato',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockProduct]);
  });

  it('clearCache() empties findAll, getFeatured and low-stock caches', () => {
    service.findAll().subscribe();
    httpMock.expectOne(url).flush([mockProduct]);
    service.getLowStock().subscribe();
    httpMock.expectOne(`${url}/low-stock`).flush([]);

    service.clearCache();

    service.findAll().subscribe();
    const secondFindAll = httpMock.expectOne(url);
    expect(secondFindAll.request.method).toBe('GET');
    secondFindAll.flush([mockProduct]);
    service.getLowStock().subscribe();
    const secondLowStock = httpMock.expectOne(`${url}/low-stock`);
    expect(secondLowStock.request.method).toBe('GET');
    secondLowStock.flush([]);
  });

  it('create() POSTs the dto and invalidates the cache', () => {
    const dto: CreateProductDto = {
      name: 'Pelota',
      costPrice: 300,
      salePrice: 500,
      stock: 20,
      isFeatured: false,
    };
    service.create(dto).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockProduct);
  });

  it('update() PATCHes /products/:id', () => {
    service.update('p1', { stock: 5 }).subscribe();
    const req = httpMock.expectOne(`${url}/p1`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockProduct);
  });

  it('remove() issues a DELETE to /products/:id', () => {
    service.remove('p1').subscribe();
    const req = httpMock.expectOne(`${url}/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getLowStock() fetches once and serves the cached BehaviorSubject value afterwards', () => {
    const lowStock: LowStockProduct[] = [
      { id: 'p2', name: 'Pelotas', stock: 1, minStock: 5 },
    ];

    service.getLowStock().subscribe((res) => expect(res).toEqual(lowStock));
    httpMock.expectOne(`${url}/low-stock`).flush(lowStock);

    // Second call must be served from the BehaviorSubject, no new HTTP request.
    service.getLowStock().subscribe((res) => expect(res).toEqual(lowStock));
    httpMock.expectNone(`${url}/low-stock`);
  });

  it('clearLowStockCache() forces a fresh GET on the next getLowStock() call', () => {
    service.getLowStock().subscribe();
    httpMock.expectOne(`${url}/low-stock`).flush([]);

    service.clearLowStockCache();

    service.getLowStock().subscribe();
    const secondReq = httpMock.expectOne(`${url}/low-stock`);
    expect(secondReq.request.method).toBe('GET');
    secondReq.flush([]);
  });
});
