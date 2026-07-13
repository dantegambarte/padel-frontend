import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InventoryAlertsComponent } from './inventory-alerts.component';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { LowStockProduct } from '../../../core/models/product.model';

describe('InventoryAlertsComponent', () => {
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const alerts: LowStockProduct[] = [
    { id: 'p1', name: 'Pelotas', stock: 0, minStock: 5, category: { id: 'c1', name: 'Bebidas' } },
    { id: 'p2', name: 'Gatorade', stock: 2, minStock: 5, category: { id: 'c2', name: 'Comida' } },
  ];

  beforeEach(async () => {
    productsServiceSpy = jasmine.createSpyObj('ProductsService', ['getLowStock']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['error']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    productsServiceSpy.getLowStock.and.returnValue(of(alerts));

    await TestBed.configureTestingModule({
    imports: [InventoryAlertsComponent],
    providers: [
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: Router, useValue: routerSpy },
    ],
    schemas: [NO_ERRORS_SCHEMA],
}).compileComponents();
  });

  it('loads alerts on init', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.allAlerts.length).toBe(2);
    expect(fixture.componentInstance.isLoading).toBe(false);
  });

  it('splits alerts into outOfStock and lowStock', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.outOfStock.map((p) => p.id)).toEqual(['p1']);
    expect(fixture.componentInstance.lowStock.map((p) => p.id)).toEqual(['p2']);
  });

  it('filteredAlerts respects searchTerm and selectedCategory', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.searchTerm = 'gato';
    expect(component.filteredAlerts.map((p) => p.id)).toEqual(['p2']);

    component.searchTerm = '';
    component.selectedCategory = 'c1';
    expect(component.filteredAlerts.map((p) => p.id)).toEqual(['p1']);
  });

  it('categories are deduplicated and sorted alphabetically', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.categories.map((c) => c.name)).toEqual([
      'Bebidas',
      'Comida',
    ]);
  });

  it('clearFilters() resets searchTerm and selectedCategory', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.searchTerm = 'x';
    component.selectedCategory = 'c1';
    component.clearFilters();
    expect(component.searchTerm).toBe('');
    expect(component.selectedCategory).toBe('');
  });

  it('stockPercent() caps at 100 and handles minStock 0', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.stockPercent({ ...alerts[1], stock: 10, minStock: 5 })).toBe(100);
    expect(component.stockPercent({ ...alerts[1], stock: 1, minStock: 0 })).toBe(100);
  });

  it('goToProduct() navigates with a highlight query param', () => {
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    fixture.componentInstance.goToProduct(alerts[0]);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app/products'], {
      queryParams: { highlight: 'p1' },
    });
  });

  it('toasts an error when loading fails', () => {
    productsServiceSpy.getLowStock.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(InventoryAlertsComponent);
    fixture.detectChanges();
    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(fixture.componentInstance.isLoading).toBe(false);
  });
});
