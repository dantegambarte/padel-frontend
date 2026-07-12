import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

import { Product } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import {
  SalesService,
  SaleDetail,
  SaleItemDetail,
} from '../../core/services/sales.service';
import { CashService } from '../../core/services/cash.service';
import { ToastService } from '../../core/services/toast.service';
import { DraftService } from '../../core/services/draft.service';
import { PosComponent } from './pos.component';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CASH_OPEN_RESPONSE = { isClosed: false, noSession: false } as any;

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Agua Mineral 500ml',
    costPrice: 150,
    salePrice: 300,
    stock: 20,
    minStock: 5,
    isFeatured: false,
    isActive: true,
    category: { id: 'cat-1', name: 'Bebidas' },
    ...overrides,
  };
}

function buildSaleItem(
  overrides: Partial<SaleItemDetail> = {},
): SaleItemDetail {
  return {
    productId: 'prod-1',
    quantity: 1,
    unitPrice: '300.00',
    product: { name: 'Agua Mineral 500ml' },
    ...overrides,
  };
}

function buildOpenSale(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: 'sale-1',
    total: '300.00',
    amountCash: '0.00',
    amountTransfer: '0.00',
    customerName: 'Mesa 3',
    status: 'open',
    createdAt: new Date().toISOString(),
    items: [buildSaleItem()],
    ...overrides,
  };
}

/** Respuesta de Swal cuando el usuario confirma con un valor de texto. */
function swalConfirmedWith(value: string) {
  return Promise.resolve({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
    value,
  } as any);
}

const SWAL_DISMISSED = Promise.resolve({
  isConfirmed: false,
  isDenied: false,
  isDismissed: true,
  value: undefined,
} as any);

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PosComponent — Cuentas Abiertas', () => {
  let component: PosComponent;
  let fixture: ComponentFixture<PosComponent>;
  let productsService: jasmine.SpyObj<ProductsService>;
  let salesService: jasmine.SpyObj<SalesService>;
  let cashService: jasmine.SpyObj<CashService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let draftService: jasmine.SpyObj<DraftService>;

  beforeEach(async () => {
    productsService = jasmine.createSpyObj<ProductsService>('ProductsService', [
      'findAll',
      'clearCache',
    ]);
    productsService.findAll.and.returnValue(of([buildProduct()]));

    salesService = jasmine.createSpyObj<SalesService>('SalesService', [
      'create',
      'findOne',
      'findOpen',
      'createOpen',
      'addItems',
      'pay',
    ]);
    salesService.findOpen.and.returnValue(of([]));

    cashService = jasmine.createSpyObj<CashService>('CashService', [
      'getCurrent',
    ]);
    cashService.getCurrent.and.returnValue(of(CASH_OPEN_RESPONSE));

    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
      'info',
    ]);

    draftService = jasmine.createSpyObj<DraftService>('DraftService', [
      'getDraft',
      'saveDraft',
      'clearDraft',
    ]);
    draftService.getDraft.and.returnValue(null);

    await TestBed.configureTestingModule({
      declarations: [PosComponent],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: SalesService, useValue: salesService },
        { provide: CashService, useValue: cashService },
        { provide: ToastService, useValue: toastService },
        { provide: DraftService, useValue: draftService },
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // dispara ngOnInit → loadProducts + loadOpenSales
  });

  afterEach(() => {
    Swal.close();
  });

  // ─── selectOpenSale / resolución de stock ───────────────────────────────────

  it('selectOpenSale: carga el carrito con el stock real del catálogo, no el histórico de la venta', () => {
    const sale = buildOpenSale({
      items: [
        buildSaleItem({
          productId: 'prod-1',
          quantity: 2,
          unitPrice: '300.00',
        }),
      ],
    });

    component.selectOpenSale(sale);

    expect(component.cart.length).toBe(1);
    expect(component.cart[0].stock).toBe(20); // stock del catálogo (buildProduct), no de la venta
    expect(component.cart[0].salePrice).toBe(300); // Number(unitPrice), no string
    expect(component.cart[0].quantity).toBe(2);
    expect(component.activeSaleId).toBe('sale-1');
    expect(component.activeSaleCustomerName).toBe('Mesa 3');
  });

  it('selectOpenSale: si el producto ya no existe en el catálogo, no bloquea el carrito con stock 0', () => {
    const sale = buildOpenSale({
      items: [
        buildSaleItem({
          productId: 'prod-eliminado',
          quantity: 1,
          product: { name: 'Producto Descontinuado' },
        }),
      ],
    });

    component.selectOpenSale(sale);

    expect(component.cart[0].name).toBe('Producto Descontinuado');
    expect(component.cart[0].stock).toBe(Number.POSITIVE_INFINITY);
    expect(component.isAtStockLimit(component.cart[0])).toBe(false);
  });

  it('selectOpenSale: no dispara ningún request nuevo, usa los items ya incluidos en la venta', () => {
    const sale = buildOpenSale();
    component.selectOpenSale(sale);
    expect(salesService.findOne).not.toHaveBeenCalled();
  });

  // ─── Getters de estado ───────────────────────────────────────────────────────

  it('isEditingOpenAccount / leaveOpenLabel reflejan si hay una cuenta cargada', () => {
    expect(component.isEditingOpenAccount).toBe(false);
    expect(component.leaveOpenLabel).toBe('Dejar Abierta');

    component.selectOpenSale(buildOpenSale());

    expect(component.isEditingOpenAccount).toBe(true);
    expect(component.leaveOpenLabel).toBe('Actualizar Cuenta');
  });

  it('cancelOpenAccountEdit: vacía el carrito y sale del modo edición', () => {
    component.selectOpenSale(buildOpenSale());
    expect(component.isEditingOpenAccount).toBe(true);

    component.cancelOpenAccountEdit();

    expect(component.cart).toEqual([]);
    expect(component.activeSaleId).toBeNull();
    expect(component.activeSaleCustomerName).toBeNull();
    expect(component.isEditingOpenAccount).toBe(false);
  });

  // ─── isLeaveOpenDisabled ──────────────────────────────────────────────────────

  it('isLeaveOpenDisabled: true con carrito vacío', () => {
    component.cart = [];
    expect(component.isLeaveOpenDisabled).toBe(true);
  });

  it('isLeaveOpenDisabled: false en venta directa con items (sin cuenta cargada)', () => {
    component.cart = [
      {
        productId: 'p1',
        name: 'X',
        salePrice: 100,
        stock: 5,
        minStock: 1,
        category: '',
        quantity: 1,
      },
    ];
    expect(component.isLeaveOpenDisabled).toBe(false);
  });

  it('isLeaveOpenDisabled: true editando una cuenta sin cambios (mismo qty que al cargarla)', () => {
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 2 })] }),
    );
    expect(component.isLeaveOpenDisabled).toBe(true);
  });

  it('isLeaveOpenDisabled: false editando una cuenta con delta positivo', () => {
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 2 })] }),
    );
    component.updateQuantity('prod-1', 1);
    expect(component.isLeaveOpenDisabled).toBe(false);
  });

  // ─── leaveOpenAccount — crear cuenta nueva ────────────────────────────────────

  it('leaveOpenAccount (venta directa): pide nombre por Swal y crea la cuenta abierta con esos items', fakeAsync(() => {
    spyOn(Swal, 'fire').and.returnValue(swalConfirmedWith('Mesa 5'));
    salesService.createOpen.and.returnValue(
      of({ id: 'new-sale', total: 300, createdAt: new Date().toISOString() }),
    );

    component.cart = [
      {
        productId: 'prod-1',
        name: 'Agua',
        salePrice: 300,
        stock: 20,
        minStock: 5,
        category: 'Bebidas',
        quantity: 2,
      },
    ];

    component.leaveOpenAccount();
    tick();

    expect(salesService.createOpen).toHaveBeenCalledWith('Mesa 5', [
      { productId: 'prod-1', quantity: 2 },
    ]);
    expect(component.cart).toEqual([]);
    expect(toastService.success).toHaveBeenCalled();
  }));

  it('leaveOpenAccount (venta directa): si se cancela el Swal, no crea nada', fakeAsync(() => {
    spyOn(Swal, 'fire').and.returnValue(SWAL_DISMISSED);

    component.cart = [
      {
        productId: 'prod-1',
        name: 'Agua',
        salePrice: 300,
        stock: 20,
        minStock: 5,
        category: '',
        quantity: 1,
      },
    ];
    component.leaveOpenAccount();
    tick();

    expect(salesService.createOpen).not.toHaveBeenCalled();
    expect(component.cart.length).toBe(1);
  }));

  it('leaveOpenAccount: no hace nada con el carrito vacío (ni siquiera abre el Swal)', () => {
    const swalSpy = spyOn(Swal, 'fire');
    component.cart = [];
    component.leaveOpenAccount();
    expect(swalSpy).not.toHaveBeenCalled();
  });

  // ─── leaveOpenAccount — actualizar cuenta existente (delta por PATCH) ─────────

  it('leaveOpenAccount (cuenta cargada): manda solo el delta de items nuevos, no el carrito completo', () => {
    component.selectOpenSale(
      buildOpenSale({
        items: [
          buildSaleItem({
            productId: 'prod-1',
            quantity: 2,
            unitPrice: '300.00',
          }),
        ],
      }),
    );
    salesService.addItems.and.returnValue(of(buildOpenSale()));

    // Simula agregar 1 unidad más del mismo producto y un producto nuevo
    component.updateQuantity('prod-1', 1); // 2 -> 3, delta = 1
    component.cart.push({
      productId: 'prod-2',
      name: 'Barrita',
      salePrice: 350,
      stock: 10,
      minStock: 2,
      category: 'Snacks',
      quantity: 1,
    });

    component.leaveOpenAccount();

    expect(salesService.addItems).toHaveBeenCalledWith('sale-1', {
      items: [
        { productId: 'prod-1', quantity: 1 },
        { productId: 'prod-2', quantity: 1 },
      ],
    });
  });

  it('leaveOpenAccount (cuenta cargada, sin cambios): no llama al backend, solo avisa "Sin cambios"', () => {
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 2 })] }),
    );

    component.leaveOpenAccount();

    expect(salesService.addItems).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledWith(
      'Sin cambios',
      jasmine.any(String),
    );
  });

  it('leaveOpenAccount (cuenta cargada): al confirmar el update, resetea el snapshot y refresca la lista', () => {
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 1 })] }),
    );
    salesService.addItems.and.returnValue(of(buildOpenSale()));
    salesService.findOpen.calls.reset();

    component.updateQuantity('prod-1', 1); // delta = 1
    component.leaveOpenAccount();

    // Sin nuevos cambios pendientes tras el update exitoso
    expect(component.isLeaveOpenDisabled).toBe(true);
    expect(salesService.findOpen).toHaveBeenCalled();
  });

  // ─── triggerCartDraftSave — no debe pisar el draft mientras se edita una cuenta abierta ─

  it('triggerCartDraftSave: no guarda draft local mientras se edita una cuenta abierta', fakeAsync(() => {
    component.selectOpenSale(buildOpenSale());
    draftService.saveDraft.calls.reset();

    component.triggerCartDraftSave();
    tick(600);

    expect(draftService.saveDraft).not.toHaveBeenCalled();
  }));

  it('triggerCartDraftSave: sí guarda draft en una venta directa (sin cuenta cargada)', fakeAsync(() => {
    draftService.saveDraft.calls.reset();

    component.triggerCartDraftSave();
    tick(600);

    expect(draftService.saveDraft).toHaveBeenCalled();
  }));

  // ─── confirmSale — bifurcación create() vs pay() ──────────────────────────────

  it('confirmSale (venta directa): llama a salesService.create, no a pay', () => {
    salesService.create.and.returnValue(
      of({ id: 'sale-x', total: 300, createdAt: new Date().toISOString() }),
    );
    component.cart = [
      {
        productId: 'prod-1',
        name: 'Agua',
        salePrice: 300,
        stock: 20,
        minStock: 5,
        category: '',
        quantity: 1,
      },
    ];
    component.montoEfectivo = '300';

    component.confirmSale();

    expect(salesService.create).toHaveBeenCalled();
    expect(salesService.pay).not.toHaveBeenCalled();
  });

  it('confirmSale (cuenta abierta cargada): llama a salesService.pay con el id de la cuenta, no a create', () => {
    salesService.pay.and.returnValue(
      of({ id: 'sale-1', total: 300, createdAt: new Date().toISOString() }),
    );
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 1 })] }),
    );
    component.montoEfectivo = '300';

    component.confirmSale();

    expect(salesService.pay).toHaveBeenCalledWith('sale-1', {
      amountCash: 300,
      amountTransfer: 0,
    });
    expect(salesService.create).not.toHaveBeenCalled();
  });

  it('confirmSale (cuenta abierta): al cobrar exitosamente, sale del modo edición y refresca la lista', () => {
    salesService.pay.and.returnValue(
      of({ id: 'sale-1', total: 300, createdAt: new Date().toISOString() }),
    );
    component.selectOpenSale(
      buildOpenSale({ items: [buildSaleItem({ quantity: 1 })] }),
    );
    component.montoEfectivo = '300';
    salesService.findOpen.calls.reset();

    component.confirmSale();

    expect(component.activeSaleId).toBeNull();
    expect(component.isEditingOpenAccount).toBe(false);
    expect(salesService.findOpen).toHaveBeenCalled();
  });

  it('confirmSale: no cobra si la caja está cerrada, sin importar el origen de la venta', () => {
    const swalSpy = spyOn(Swal, 'fire').and.returnValue(SWAL_DISMISSED);
    component.isCashRegisterOpen = false;
    component.cart = [
      {
        productId: 'prod-1',
        name: 'Agua',
        salePrice: 300,
        stock: 20,
        minStock: 5,
        category: '',
        quantity: 1,
      },
    ];
    component.montoEfectivo = '300';

    component.confirmSale();

    expect(swalSpy).toHaveBeenCalled();
    expect(salesService.create).not.toHaveBeenCalled();
    expect(salesService.pay).not.toHaveBeenCalled();
  });
});
