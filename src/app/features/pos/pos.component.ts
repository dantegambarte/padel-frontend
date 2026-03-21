import { Component, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { finalize } from 'rxjs';

import { Product } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import { SalesService, CreateSaleDto } from '../../core/services/sales.service';
import { ToastService } from '../../core/services/toast.service';
import Swal from 'sweetalert2';

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
export class PosComponent implements OnInit, AfterViewInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  cart: PosCartItem[] = [];
  searchQuery = '';
  customerName = '';
  montoEfectivo = '';
  montoTransferencia = '';
  isLoadingProducts = false;
  isSubmitting = false;
  isMobileCartOpen = false;
  checkoutStep = 1;
  desktopStep = 1;
  selectedItemDetail: PosCartItem | null = null;
  isDetailModalOpen = false;

  touchStartY = 0;
  touchEndY = 0;
  readonly swipeThreshold = 50;

  lastSaleId: string | null = null;

  constructor(
    private productsService: ProductsService,
    private salesService: SalesService,
    private toast: ToastService,
    private el: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  /**
   * Registra el listener de touchmove como NO pasivo para poder llamar
   * preventDefault() y evitar que el scroll del browser robe el gesto de swipe.
   */
  ngAfterViewInit(): void {
    const swipeZone = this.el.nativeElement.querySelector<HTMLElement>('[data-swipe-zone]');
    if (!swipeZone) return;
    swipeZone.addEventListener('touchmove', (e: TouchEvent) => {
      this.touchEndY = e.changedTouches[0].screenY;
      if (this.touchEndY - this.touchStartY > 10) e.preventDefault();
    }, { passive: false });
  }

  /**
   * Carga todos los productos activos desde el servidor.
   * Filtra los inactivos antes de asignarlos al estado.
   */
  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.productsService
      .findAll()
      .pipe(finalize(() => (this.isLoadingProducts = false)))
      .subscribe({
        next: (products) => {
          this.products = products.filter((p) => p.isActive);
          this.applyFilter();
        },
        error: () => {
          this.toast.error(
            'Error al cargar productos',
            'Intente recargar la página',
          );
        },
      });
  }

  /** Elimina diacríticos (tildes) para comparación insensible a acentos. */
  private normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /**
   * Recalcula `filteredProducts` a partir del estado actual de `products` y `searchQuery`.
   * Llamar explícitamente en lugar de usar un getter evita que Angular recorra
   * el array entero en cada ciclo de detección de cambios.
   */
  private applyFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filteredProducts = this.products;
      return;
    }
    const q = this.normalize(this.searchQuery);
    this.filteredProducts = this.products.filter((p) => this.normalize(p.name).includes(q));
  }

  /** Manejador del evento (ngModelChange) del buscador. Actualiza el array filtrado. */
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applyFilter();
  }

  /** Devuelve la cantidad actual de un producto en el carrito (0 si no está). */
  getQuantityInCart(product: Product): number {
    return this.cart.find((i) => i.productId === product.id)?.quantity ?? 0;
  }

  /** Suma total de unidades en el carrito. */
  get totalItems(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.changedTouches[0].screenY;
    this.touchEndY = 0;
  }

  // touchmove se maneja en ngAfterViewInit con { passive: false } para poder llamar preventDefault()

  onTouchEnd(): void {
    // Solo actúa si hubo movimiento real (touchMove registrado)
    if (this.touchEndY === 0) return;
    const deltaY = this.touchEndY - this.touchStartY;
    if (deltaY > this.swipeThreshold) {
      this.isMobileCartOpen = false;
      this.checkoutStep = 1;
    }
    this.touchStartY = 0;
    this.touchEndY = 0;
  }

  /** Alterna la visibilidad del carrito en móvil. Al abrir, reinicia al paso 1. */
  toggleMobileCart(): void {
    this.isMobileCartOpen = !this.isMobileCartOpen;
    if (this.isMobileCartOpen) this.checkoutStep = 1;
  }

  /** Avanza al paso 2 del wizard de pago (solo móvil). */
  nextStep(): void {
    this.checkoutStep = 2;
  }

  /** Retrocede al paso 1 del wizard (solo móvil). */
  prevStep(): void {
    this.checkoutStep = 1;
  }

  /** Avanza al paso 2 del wizard desktop. */
  nextDesktopStep(): void {
    this.desktopStep = 2;
  }

  /** Retrocede al paso 1 del wizard desktop. */
  prevDesktopStep(): void {
    this.desktopStep = 1;
  }

  /** Total del carrito sumando precio × cantidad de cada ítem. */
  get total(): number {
    return this.cart.reduce(
      (sum, item) => sum + item.salePrice * item.quantity,
      0,
    );
  }

  /** Monto en efectivo ingresado, convertido a número. */
  get efectivo(): number {
    return parseFloat(this.montoEfectivo) || 0;
  }

  /** Monto en transferencia ingresado, convertido a número. */
  get transferencia(): number {
    return parseFloat(this.montoTransferencia) || 0;
  }

  /** Suma del efectivo y la transferencia ingresados. */
  get totalPagado(): number {
    return this.efectivo + this.transferencia;
  }

  /** Diferencia entre el total del carrito y lo ya pagado (puede ser negativa = vuelto). */
  get faltante(): number {
    return this.total - this.totalPagado;
  }

  /** Indica si se deben mostrar los detalles de pago en la UI. */
  get showPaymentDetails(): boolean {
    return this.totalPagado > 0;
  }

  /** `true` cuando el botón "Confirmar Venta" debe estar deshabilitado. */
  get isConfirmDisabled(): boolean {
    return (
      this.cart.length === 0 ||
      this.isSubmitting ||
      this.totalPagado < this.total
    );
  }

  /** `true` si el producto es de categoría "Alquileres" (servicio retornable sin límite de stock). */
  protected isRental(product: Product | PosCartItem): boolean {
    const cat =
      'category' in product && typeof product.category === 'object'
        ? (product.category as { name?: string })?.name
        : (product as PosCartItem).category;
    return (cat ?? '').toLowerCase().includes('alquiler');
  }

  /**
   * Agrega un producto al carrito o incrementa su cantidad si ya existe.
   * Para productos de categoría "Alquileres" no se valida el stock (es un servicio retornable).
   * @param product - Producto a agregar.
   */
  addToCart(product: Product): void {
    const existing = this.cart.find((i) => i.productId === product.id);
    const rental = this.isRental(product);

    // Bloquear temprano si la tarjeta del catálogo fue clicada estando al límite.
    // El HTML ya aplica pointer-events-none para no-alquileres, pero esta guardia
    // cubre cualquier llamada programática o de teclado que pueda pasar el template.
    if (!rental && existing && existing.quantity >= product.stock) {
      this.toast.error(
        'Límite de stock alcanzado',
        `Ya tenés ${product.stock} unidad${product.stock !== 1 ? 'es' : ''} de "${product.name}" en el carrito`,
      );
      return;
    }

    if (existing) {
      if (rental || existing.quantity < product.stock) {
        this.cart = this.cart.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      } else {
        this.toast.error(
          'Stock insuficiente',
          `Solo hay ${product.stock} unidades disponibles`,
        );
      }
    } else {
      this.cart = [
        ...this.cart,
        {
          productId: product.id,
          name: product.name,
          salePrice: product.salePrice,
          stock: product.stock,
          category: product.category?.name ?? '',
          quantity: 1,
        },
      ];
    }
  }

  /**
   * Incrementa o decrementa la cantidad de un ítem del carrito.
   * Si la nueva cantidad llega a 0, elimina el ítem.
   * @param productId - Identificador del producto.
   * @param delta     - Valor a sumar (positivo o negativo).
   */
  updateQuantity(productId: string, delta: number): void {
    const item = this.cart.find((i) => i.productId === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      this.removeFromCart(productId);
    } else if (this.isRental(item) || newQty <= item.stock) {
      this.cart = this.cart.map((i) =>
        i.productId === productId ? { ...i, quantity: newQty } : i,
      );
    }
    // Si newQty > stock para no-alquileres, simplemente no hace nada.
    // El botón + está deshabilitado en el HTML, por lo que este caso
    // solo podría ocurrir por manipulación directa — sin toast para evitar spam.
  }

  /**
   * `true` cuando el botón "+" debe estar deshabilitado para un ítem del carrito.
   * Los alquileres nunca tienen límite de stock.
   */
  isAtStockLimit(item: PosCartItem): boolean {
    return !this.isRental(item) && item.quantity >= item.stock;
  }

  /** Abre el modal de detalle para el ítem seleccionado. */
  showItemDetails(item: PosCartItem): void {
    this.selectedItemDetail = item;
    this.isDetailModalOpen = true;
  }

  /** Cierra el modal de detalle y limpia la selección. */
  closeDetailModal(): void {
    this.isDetailModalOpen = false;
    this.selectedItemDetail = null;
  }

  /**
   * Elimina un ítem del carrito por su id de producto.
   * @param productId - Identificador del producto a quitar.
   */
  removeFromCart(productId: string): void {
    this.cart = this.cart.filter((i) => i.productId !== productId);
  }

  /** Cierra el ticket modal de la última venta. */
  closeTicket(): void {
    this.lastSaleId = null;
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    if (value === 0) return '0';
    return value.toLocaleString('es-AR');
  }

  /**
   * Valida el carrito y el pago, luego envía la venta al servidor.
   * Limpia el carrito y los montos de pago al completarse con éxito.
   */
  confirmSale(): void {
    if (this.cart.length === 0) {
      this.toast.error(
        'Carrito vacío',
        'Agregue productos al carrito para realizar una venta',
      );
      return;
    }
    if (this.totalPagado < this.total) {
      this.toast.error(
        'Pago insuficiente',
        `Faltan $${this.fmt(this.faltante)} para completar la venta`,
      );
      return;
    }

    const dto: CreateSaleDto = {
      items: this.cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      amountCash: this.efectivo,
      amountTransfer: this.transferencia,
      ...(this.customerName.trim() && {
        customerName: this.customerName.trim(),
      }),
    };

    const totalStr = this.fmt(this.total);

    this.isSubmitting = true;
    this.salesService
      .create(dto)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (sale) => {
          this.cart = [];
          this.customerName = '';
          this.montoEfectivo = '';
          this.montoTransferencia = '';
          this.isMobileCartOpen = false;
          this.checkoutStep = 1;
          this.desktopStep = 1;
          this.lastSaleId = sale.id;
          this.toast.success(
            'Venta confirmada',
            `Se procesó una venta por $${totalStr}`,
          );
        },
        error: (err) => {
          // Detectar CAJA_CERRADA independientemente del campo que use el backend:
          // errorCode, code, o un mensaje que contenga la cadena.
          const errBody = err.error ?? {};
          const isCajaCerrada =
            errBody.errorCode === 'CAJA_CERRADA' ||
            errBody.code === 'CAJA_CERRADA' ||
            (typeof errBody.message === 'string' &&
              errBody.message.toUpperCase().includes('CAJA_CERRADA'));

          if (isCajaCerrada) {
            Swal.fire({
              icon: 'error',
              title: 'Caja Cerrada',
              text: 'Por favor, ve al módulo de Caja y realiza la apertura de tu turno para poder cobrar.',
            });
          } else if (err.status === 409) {
            this.toast.error(
              'Stock insuficiente',
              'Uno o más productos no tienen stock suficiente',
            );
            this.loadProducts();
          } else {
            const errMsg = err.error?.message ?? 'Error desconocido al procesar la venta';
            this.toast.error('Error al procesar venta', errMsg);
          }
        },
      });
  }
}
