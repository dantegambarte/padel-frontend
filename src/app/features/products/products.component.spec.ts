import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductsComponent } from './products.component';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Product } from '../../core/models/product.model';

describe('ProductsComponent', () => {
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let activatedRouteStub: any;

  const bebidas = { id: 'cat1', name: 'Bebidas' };
  const alquileres = { id: 'cat2', name: 'Alquileres' };

  const productA: Product = {
    id: 'p1',
    name: 'Gatorade',
    costPrice: 500,
    salePrice: 800,
    stock: 10,
    minStock: 2,
    isFeatured: false,
    isActive: true,
    category: bebidas,
  };
  const productOutOfStock: Product = {
    id: 'p2',
    name: 'Powerade',
    costPrice: 500,
    salePrice: 800,
    stock: 0,
    minStock: 2,
    isFeatured: false,
    isActive: true,
    category: bebidas,
  };
  const productLowStock: Product = {
    id: 'p3',
    name: 'Agua',
    costPrice: 200,
    salePrice: 400,
    stock: 1,
    minStock: 3,
    isFeatured: true,
    isActive: true,
    category: bebidas,
  };

  function setup(isAdmin = true, highlightId: string | null = null) {
    productsServiceSpy = jasmine.createSpyObj('ProductsService', [
      'findAll',
      'getCategories',
      'createCategory',
      'create',
      'update',
      'remove',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], { isAdmin });
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    activatedRouteStub = {
      snapshot: { queryParamMap: convertToParamMap(highlightId ? { highlight: highlightId } : {}) },
    };

    productsServiceSpy.findAll.and.returnValue(of([productA, productOutOfStock, productLowStock]));
    productsServiceSpy.getCategories.and.returnValue(of([bebidas, alquileres]));

    TestBed.configureTestingModule({
    imports: [ProductsComponent],
    providers: [
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
  }

  it('loads products and categories on init', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.products.length).toBe(3);
    expect(fixture.componentInstance.categories).toEqual([bebidas, alquileres]);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('toasts an error when products fail to load', () => {
    setup();
    productsServiceSpy.findAll.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('outOfStockCount / lowStockCount classify by minStock threshold', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.outOfStockCount).toBe(1);
    expect(fixture.componentInstance.lowStockCount).toBe(1);
  });

  it('totalInventoryValue sums salePrice * stock across all products', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    // 800*10 + 800*0 + 400*1 = 8400
    expect(fixture.componentInstance.totalInventoryValue).toBe(8400);
  });

  it('filteredProducts applies search, category and stock filters', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.searchQuery = 'gator';
    expect(component.filteredProducts.map((p) => p.id)).toEqual(['p1']);

    component.searchQuery = '';
    component.filterStock = 'zero';
    expect(component.filteredProducts.map((p) => p.id)).toEqual(['p2']);

    component.filterStock = 'low';
    expect(component.filteredProducts.map((p) => p.id)).toEqual(['p3']);
  });

  it('clearFilters() resets search, category and stock filters', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchQuery = 'x';
    component.filterCategory = 'cat1';
    component.filterStock = 'low';
    component.clearFilters();
    expect(component.hasActiveFilters).toBe(false);
  });

  it('scrolls to and highlights the product from the "highlight" query param', () => {
    setup(true, 'p1');
    const div = document.createElement('div');
    div.id = 'product-p1';
    document.body.appendChild(div);

    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.highlightedProductId).toBe('p1');
    document.body.removeChild(div);
  });

  it('openCreate() resets the form to empty values', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    expect(fixture.componentInstance.isDialogOpen).toBe(true);
    expect(fixture.componentInstance.dialogMode).toBe('create');
    expect(fixture.componentInstance.form.name).toBe('');
  });

  it('openEdit() pre-fills the form from the product', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openEdit(productA);
    expect(fixture.componentInstance.dialogMode).toBe('edit');
    expect(fixture.componentInstance.form.name).toBe('Gatorade');
    expect(fixture.componentInstance.form.category).toBe('cat1');
  });

  it('isRentalCategory is true when the selected category name contains "alquiler"', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form.category = 'cat2';
    expect(fixture.componentInstance.isRentalCategory).toBe(true);
  });

  it('saveProduct() rejects an incomplete form without calling the service', () => {
    setup();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();

    fixture.componentInstance.saveProduct();

    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(productsServiceSpy.create).not.toHaveBeenCalled();
  });

  it('saveProduct() creates a product with a valid form and closes the dialog', () => {
    setup();
    const created: Product = { ...productA, id: 'p4', name: 'Nuevo' };
    productsServiceSpy.create.and.returnValue(of(created));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form = {
      name: 'Nuevo',
      category: 'cat1',
      costPrice: '100',
      salePrice: '200',
      stock: '5',
      minStock: '2',
      isFeatured: false,
      icon: 'inventory_2',
    };

    fixture.componentInstance.saveProduct();

    expect(productsServiceSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.isDialogOpen).toBe(false);
    expect(fixture.componentInstance.products.some((p) => p.id === 'p4')).toBe(true);
  });

  it('saveProduct() for a rental category forces costPrice/stock to 0', () => {
    setup();
    productsServiceSpy.create.and.returnValue(of({ ...productA, id: 'p5' }));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form = {
      name: 'Alquiler de paleta',
      category: 'cat2',
      costPrice: '',
      salePrice: '1000',
      stock: '',
      minStock: '5',
      isFeatured: false,
      icon: 'inventory_2',
    };

    fixture.componentInstance.saveProduct();

    const dto = productsServiceSpy.create.calls.mostRecent().args[0];
    expect(dto.costPrice).toBe(0);
    expect(dto.stock).toBe(0);
  });

  it('saveProduct() creates a new category first when isNewCategory is true', () => {
    setup();
    productsServiceSpy.createCategory.and.returnValue(of({ id: 'cat3', name: 'Snacks' }));
    productsServiceSpy.create.and.returnValue(of({ ...productA, id: 'p6' }));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form.category = '__nueva__';
    fixture.componentInstance.newCategoryName = 'Snacks';
    fixture.componentInstance.form.name = 'Papas';
    fixture.componentInstance.form.salePrice = '500';
    fixture.componentInstance.form.costPrice = '200';
    fixture.componentInstance.form.stock = '10';

    fixture.componentInstance.saveProduct();

    expect(productsServiceSpy.createCategory).toHaveBeenCalledWith('Snacks');
    expect(productsServiceSpy.create).toHaveBeenCalled();
    expect(fixture.componentInstance.categories.some((c) => c.id === 'cat3')).toBe(true);
  });

  it('saveProduct() shows a specific error on 409 conflict', () => {
    setup();
    productsServiceSpy.create.and.returnValue(
      throwError(() => ({ status: 409 })),
    );
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.componentInstance.form = {
      name: 'Dup',
      category: 'cat1',
      costPrice: '100',
      salePrice: '200',
      stock: '5',
      minStock: '2',
      isFeatured: false,
      icon: 'inventory_2',
    };

    fixture.componentInstance.saveProduct();

    expect(toastServiceSpy.error).toHaveBeenCalledWith('Ya existe', jasmine.any(String));
  });

  it('deleteProduct() removes the product from the local list on success', () => {
    setup();
    productsServiceSpy.remove.and.returnValue(of(undefined));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteProduct(productA);

    expect(fixture.componentInstance.products.find((p) => p.id === 'p1')).toBeUndefined();
    expect(toastServiceSpy.success).toHaveBeenCalled();
  });

  it('persistToggleFeatured() applies an optimistic update and reverts on error', () => {
    setup();
    productsServiceSpy.update.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    const product = fixture.componentInstance.products.find((p) => p.id === 'p1')!;
    const original = product.isFeatured;

    fixture.componentInstance.persistToggleFeatured(product);

    // Optimistic flip happened synchronously before the error came back.
    expect(product.isFeatured).toBe(original);
    expect(toastServiceSpy.error).toHaveBeenCalled();
  });

  it('persistToggleFeatured() ignores a second call while one is already in flight', () => {
    setup();
    productsServiceSpy.update.and.returnValue(of(productA));
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    fixture.componentInstance.togglingFeaturedIds.add('p1');

    fixture.componentInstance.persistToggleFeatured(productA);

    expect(productsServiceSpy.update).not.toHaveBeenCalled();
  });

  it('isReadOnly reflects the inverse of AuthService.isAdmin', () => {
    setup(false);
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isReadOnly).toBe(true);
  });
});
