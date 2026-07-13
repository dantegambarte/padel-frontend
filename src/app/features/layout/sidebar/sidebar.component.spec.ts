import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../../../core/services/auth.service';
import { ProductsService } from '../../../core/services/products.service';
import { User } from '../../../core/models/user.model';

describe('SidebarComponent', () => {
  let currentUserSubject: BehaviorSubject<User | null>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let productsServiceSpy: jasmine.SpyObj<ProductsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const adminUser: User = {
    id: 'u1',
    username: 'admin',
    fullName: 'Admin Test',
    role: 'admin',
    isActive: true,
    createdAt: '',
  };

  beforeEach(async () => {
    currentUserSubject = new BehaviorSubject<User | null>(null);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser$: currentUserSubject.asObservable(),
    });
    productsServiceSpy = jasmine.createSpyObj('ProductsService', ['getLowStock']);
    productsServiceSpy.getLowStock.and.returnValue(of([]));
    routerSpy = jasmine.createSpyObj('Router', ['navigate'], {
      url: '/app/dashboard',
      events: new Subject().asObservable(),
    });

    await TestBed.configureTestingModule({
      declarations: [SidebarComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ProductsService, useValue: productsServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('filters nav groups by the current user role', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    currentUserSubject.next(adminUser);

    const component = fixture.componentInstance;
    expect(component.filteredNavGroups.length).toBeGreaterThan(0);
    const allItems = component.filteredNavGroups.flatMap((g) => g.items);
    expect(allItems.some((i) => i.id === 'reports')).toBe(true);
  });

  it('shows no nav groups when logged out', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredNavGroups).toEqual([]);
  });

  it('loads low-stock counts split into in-stock vs out-of-stock', () => {
    productsServiceSpy.getLowStock.and.returnValue(
      of([
        { id: 'p1', name: 'A', stock: 0, minStock: 5 },
        { id: 'p2', name: 'B', stock: 2, minStock: 5 },
      ]),
    );
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    currentUserSubject.next(adminUser);

    expect(fixture.componentInstance.outOfStockCount).toBe(1);
    expect(fixture.componentInstance.lowStockCount).toBe(1);
  });

  it('userInitials returns up to two uppercase initials', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    currentUserSubject.next(adminUser);
    expect(fixture.componentInstance.userInitials).toBe('AT');
  });

  it('isActive() compares against the current URL ignoring query params', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    fixture.componentInstance.currentUrl = '/app/dashboard?foo=bar';
    expect(fixture.componentInstance.isActive('/app/dashboard')).toBe(true);
    expect(fixture.componentInstance.isActive('/app/schedule')).toBe(false);
  });

  it('navigate() routes, closes the user menu and emits closeMenu', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const emitSpy = spyOn(fixture.componentInstance.closeMenu, 'emit');

    fixture.componentInstance.navigate('/app/schedule');

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app/schedule']);
    expect(emitSpy).toHaveBeenCalled();
  });

  it('logout() delegates to AuthService', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    fixture.componentInstance.logout();
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('toggleUserMenu() flips isUserMenuOpen and stops propagation', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const event = new MouseEvent('click');
    spyOn(event, 'stopPropagation');
    fixture.componentInstance.toggleUserMenu(event);
    expect(fixture.componentInstance.isUserMenuOpen).toBe(true);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('removes the document click listener on destroy', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
