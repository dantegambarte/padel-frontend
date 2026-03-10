import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { Product } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import { SalesService, CreateSaleDto } from '../../core/services/sales.service';
import { ToastService } from '../../core/services/toast.service';

interface PosCartItem {
  productId: string;
  name: string;
  salePrice: number;
  stock: number;
  category: string;
  quantity: number;
}

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {

  // ── State ─────────────────────────────────────────────────────────────────────
  products: Product[] = [];
  cart: PosCartItem[] = [];   // Immutable updates — mismo patrón que React setState
  searchQuery = '';
  montoEfectivo = '';
  montoTransferencia = '';
  isLoadingProducts = false;
  isSubmitting = false;

  constructor(
    private productsService: ProductsService,
    private salesService: SalesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productsService.findAll().pipe(
      finalize(() => (this.isLoadingProducts = false)),
    ).subscribe({
      next: (products) => { this.products = products.filter(p => p.isActive); },
      error: () => { this.toast.error('Error al cargar productos', 'Intente recargar la página'); },
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  get filteredProducts(): Product[] {
    if (!this.searchQuery.trim()) return this.products;
    const q = this.searchQuery.toLowerCase();
    return this.products.filter(p => p.name.toLowerCase().includes(q));
  }

  get total(): number {
    return this.cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  }

  get efectivo(): number { return parseFloat(this.montoEfectivo) || 0; }
  get transferencia(): number { return parseFloat(this.montoTransferencia) || 0; }
  get totalPagado(): number { return this.efectivo + this.transferencia; }
  get faltante(): number { return this.total - this.totalPagado; }
  get showPaymentDetails(): boolean { return this.totalPagado > 0; }
  get isConfirmDisabled(): boolean {
    return this.cart.length === 0 || this.isSubmitting || this.totalPagado < this.total;
  }

  // ── Cart (IMMUTABLE — identical to React's setCart pattern) ───────────────────
  addToCart(product: Product): void {
    const existing = this.cart.find(i => i.productId === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        this.cart = this.cart.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      } else {
        this.toast.error('Stock insuficiente', `Solo hay ${product.stock} unidades disponibles`);
      }
    } else {
      this.cart = [
        ...this.cart,
        {
          productId: product.id,
          name:      product.name,
          salePrice: product.salePrice,
          stock:     product.stock,
          category:  product.category?.name ?? '',
          quantity:  1,
        },
      ];
    }
  }

  updateQuantity(productId: string, delta: number): void {
    const item = this.cart.find(i => i.productId === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      this.removeFromCart(productId);
    } else if (newQty <= item.stock) {
      this.cart = this.cart.map(i =>
        i.productId === productId ? { ...i, quantity: newQty } : i,
      );
    } else {
      this.toast.error('Stock insuficiente', `Solo hay ${item.stock} unidades disponibles`);
    }
  }

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter(i => i.productId !== productId);
  }

  // ── Formatter ─────────────────────────────────────────────────────────────────
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  confirmSale(): void {
    if (this.cart.length === 0) {
      this.toast.error('Carrito vacío', 'Agregue productos al carrito para realizar una venta');
      return;
    }
    if (this.totalPagado < this.total) {
      this.toast.error('Pago insuficiente', `Faltan $${this.fmt(this.faltante)} para completar la venta`);
      return;
    }

    const dto: CreateSaleDto = {
      items:           this.cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
      amountCash:      this.efectivo,
      amountTransfer:  this.transferencia,
    };

    // Guardamos el total antes de limpiar el carrito para usarlo en el toast
    const totalStr = this.fmt(this.total);

    this.isSubmitting = true;
    this.salesService.create(dto).pipe(
      finalize(() => (this.isSubmitting = false)),
    ).subscribe({
      next: () => {
        this.cart = [];
        this.montoEfectivo = '';
        this.montoTransferencia = '';
        this.toast.success('Venta confirmada', `Se procesó una venta por $${totalStr}`);
      },
      error: (err) => {
        if (err.status === 503) {
          this.toast.error('Caja cerrada', 'Debe abrir la caja antes de registrar ventas');
        } else if (err.status === 409) {
          this.toast.error('Stock insuficiente', 'Uno o más productos no tienen stock suficiente');
          this.loadProducts(); // refresca stock desde el backend
        } else {
          this.toast.error('Error al procesar venta', 'Intente nuevamente');
        }
      },
    });
  }
}
