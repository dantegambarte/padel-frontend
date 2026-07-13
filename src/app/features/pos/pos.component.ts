import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, finalize } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Product } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import {
  SalesService,
  CreateSaleDto,
  SaleDetail,
  SaleItemDetail,
} from '../../core/services/sales.service';
import { CashService } from '../../core/services/cash.service';
import { ToastService } from '../../core/services/toast.service';
import { DraftService } from '../../core/services/draft.service';
import { getCategoryColor } from '../../core/utils/category-colors';
import Swal from 'sweetalert2';

interface PosCartItem {
  productId: string;
  name: string;
  salePrice: number;
  stock: number;
  minStock: number;
  category: string;
  quantity: number;
}

@Component({
  standalone: false,
  selector: 'app-pos',
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit, OnDestroy, AfterViewInit {
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

  @ViewChildren('cartScrollContainer')
  private cartScrollContainers!: QueryList<ElementRef>;

  touchStartY = 0;
  touchEndY = 0;
  readonly swipeThreshold = 50;

  lastSaleId: string | null = null;

  toastMessage: string | null = null;
  private toastTimeout: any;

  /**
   * Estado de la caja en tiempo real.
   * Default `true` (optimista) para no bloquear en caso de red lenta al iniciar.
   * Se actualiza en `ngOnInit` con la respuesta real del servidor.
   */
  isCashRegisterOpen = true;

  /** Vista activa del panel izquierdo: catálogo de productos o cuentas abiertas. */
  mainView: 'catalog' | 'open-accounts' = 'catalog';
  openSales: SaleDetail[] = [];
  isLoadingOpenSales = false;

  /** Cuenta abierta cargada en el ticket actual (null = venta directa nueva). */
  activeSaleId: string | null = null;
  activeSaleCustomerName: string | null = null;
  /** Foto del carrito al cargar la cuenta, para calcular el delta a enviar por PATCH. */
  private originalCartSnapshot: PosCartItem[] = [];
  /** Índice de productos (incluye inactivos) para resolver stock real de ítems de cuentas abiertas. */
  private allProductsById = new Map<string, Product>();

  /** Draft del carrito POS. */
  showCartDraftBanner = false;
  cartDraftItemCount = 0;
  private readonly DRAFT_KEY_CART = 'draft_pos_cart';
  private cartDraftSave$ = new Subject<void>();
  private sub = new Subscription();

  constructor(
    private productsService: ProductsService,
    private salesService: SalesService,
    private cashService: CashService,
    private router: Router,
    private toast: ToastService,
    private el: ElementRef<HTMLElement>,
    private draftService: DraftService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.checkCashStatus();
    this.loadOpenSales();

    this.sub.add(
      this.cartDraftSave$.pipe(debounceTime(500)).subscribe(() => {
        this.draftService.saveDraft(this.DRAFT_KEY_CART, {
          cart: this.cart,
          customerName: this.customerName,
          montoEfectivo: this.montoEfectivo,
          montoTransferencia: this.montoTransferencia,
        });
      }),
    );

    const draft = this.draftService.getDraft<{
      cart: PosCartItem[];
      customerName: string;
      montoEfectivo: string;
      montoTransferencia: string;
    }>(this.DRAFT_KEY_CART);
    if (draft?.cart?.length) {
      this.showCartDraftBanner = true;
      this.cartDraftItemCount = draft.cart.reduce((s, i) => s + i.quantity, 0);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Restaura el carrito guardado en el borrador. */
  restoreCartDraft(): void {
    const draft = this.draftService.getDraft<{
      cart: PosCartItem[];
      customerName: string;
      montoEfectivo: string;
      montoTransferencia: string;
    }>(this.DRAFT_KEY_CART);
    if (!draft) return;
    this.cart = draft.cart ?? [];
    this.customerName = draft.customerName ?? '';
    this.montoEfectivo = draft.montoEfectivo ?? '';
    this.montoTransferencia = draft.montoTransferencia ?? '';
    this.showCartDraftBanner = false;
  }

  /** Descarta el banner sin restaurar el borrador. */
  dismissCartDraft(): void {
    this.showCartDraftBanner = false;
    this.draftService.clearDraft(this.DRAFT_KEY_CART);
  }

  /**
   * Dispara el auto-save del carrito (con debounce).
   * No aplica mientras se edita una cuenta abierta: esa se persiste en el
   * backend con `add-items`/`pay`, guardarla en el draft local pisaría
   * el draft real de una venta directa a medio armar.
   */
  triggerCartDraftSave(): void {
    if (this.isEditingOpenAccount) return;
    this.cartDraftSave$.next();
  }

  /**
   * Consulta el estado actual de la caja al montar el componente.
   * Usa el caché de 10 s de `CashService.getCurrent()` para no generar
   * una petición extra si el Layout u otro componente ya lo cargó recientemente.
   * En caso de error de red se mantiene el default optimista para no bloquear ventas.
   */
  private checkCashStatus(): void {
    this.cashService.getCurrent().subscribe({
      next: (cash) => {
        this.isCashRegisterOpen = !cash.isClosed && !cash.noSession;
      },
      error: () => {
        this.isCashRegisterOpen = true;
      },
    });
  }

  /**
   * Registra el listener de touchmove como NO pasivo para poder llamar
   * preventDefault() y evitar que el scroll del browser robe el gesto de swipe.
   */
  ngAfterViewInit(): void {
    const swipeZone =
      this.el.nativeElement.querySelector<HTMLElement>('[data-swipe-zone]');
    if (!swipeZone) return;
    swipeZone.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        this.touchEndY = e.changedTouches[0].screenY;
        if (this.touchEndY - this.touchStartY > 10) e.preventDefault();
      },
      { passive: false },
    );
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
          this.allProductsById = new Map(products.map((p) => [p.id, p]));
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

  /** Carga la lista de cuentas abiertas para el tab lateral. */
  loadOpenSales(): void {
    this.isLoadingOpenSales = true;
    this.salesService
      .findOpen()
      .pipe(finalize(() => (this.isLoadingOpenSales = false)))
      .subscribe({
        next: (sales) => (this.openSales = sales),
        error: () => {
          this.toast.error('Error', 'No se pudieron cargar las cuentas abiertas');
        },
      });
  }

  /** `true` cuando el ticket actual corresponde a una cuenta abierta cargada. */
  get isEditingOpenAccount(): boolean {
    return this.activeSaleId !== null;
  }

  /** Etiqueta del botón naranja según haya o no una cuenta abierta cargada. */
  get leaveOpenLabel(): string {
    return this.isEditingOpenAccount ? 'Actualizar Cuenta' : 'Dejar Abierta';
  }

  /**
   * Carga una cuenta abierta de la lista lateral en el ticket actual.
   * `findOpen()` ya trae los items con producto incluido — no hace falta un
   * segundo request, evita una vuelta de red innecesaria por cada click.
   * El stock de cada ítem se resuelve contra el catálogo en memoria, no contra
   * la venta: el stock es responsabilidad del producto, no del ítem histórico.
   */
  selectOpenSale(sale: SaleDetail): void {
    this.cart = sale.items.map((i) => this.toCartItem(i));
    this.originalCartSnapshot = this.cart.map((i) => ({ ...i }));
    this.activeSaleId = sale.id;
    this.activeSaleCustomerName = sale.customerName;
    this.mainView = 'catalog';
    this.desktopStep = 1;
    this.checkoutStep = 1;
  }

  /** Mapea un ítem histórico de venta a ítem de carrito, resolviendo stock actual. */
  private toCartItem(saleItem: SaleItemDetail): PosCartItem {
    const product = this.allProductsById.get(saleItem.productId);
    return {
      productId: saleItem.productId,
      name: product?.name ?? saleItem.product.name,
      salePrice: Number(saleItem.unitPrice),
      quantity: saleItem.quantity,
      stock: product?.stock ?? Number.POSITIVE_INFINITY,
      minStock: product?.minStock ?? 0,
      category: product?.category?.name ?? '',
    };
  }

  /** Cancela la edición de la cuenta abierta actual y vacía el ticket. */
  cancelOpenAccountEdit(): void {
    this.cart = [];
    this.activeSaleId = null;
    this.activeSaleCustomerName = null;
    this.originalCartSnapshot = [];
    this.triggerCartDraftSave();
  }

  /** `true` cuando el botón "Actualizar Cuenta" debe estar deshabilitado. */
  get isLeaveOpenDisabled(): boolean {
    if (this.cart.length === 0 || this.isSubmitting) return true;
    return this.isEditingOpenAccount && this.diffNewItems().length === 0;
  }

  /** Cantidades agregadas desde que se cargó la cuenta abierta (delta a enviar por PATCH). */
  private diffNewItems(): { productId: string; quantity: number }[] {
    return this.cart
      .map((item) => {
        const original = this.originalCartSnapshot.find(
          (o) => o.productId === item.productId,
        );
        const delta = item.quantity - (original?.quantity ?? 0);
        return delta > 0 ? { productId: item.productId, quantity: delta } : null;
      })
      .filter(
        (x): x is { productId: string; quantity: number } => x !== null,
      );
  }

  /**
   * Botón "Dejar Abierta" / "Actualizar Cuenta".
   * Sin cuenta cargada: crea una venta 'open' pidiendo nombre de cliente/mesa.
   * Con cuenta cargada: envía solo el delta de ítems nuevos por PATCH.
   */
  leaveOpenAccount(): void {
    if (this.cart.length === 0) return;

    if (this.isEditingOpenAccount) {
      const newItems = this.diffNewItems();
      if (newItems.length === 0) {
        this.toast.error('Sin cambios', 'No agregaste productos nuevos');
        return;
      }
      this.salesService.addItems(this.activeSaleId!, { items: newItems }).subscribe({
        next: () => {
          this.originalCartSnapshot = this.cart.map((i) => ({ ...i }));
          this.toast.success('Cuenta actualizada', '');
          this.loadOpenSales();
        },
        error: () => this.toast.error('Error', 'No se pudo actualizar la cuenta'),
      });
      return;
    }

    Swal.fire({
      title: 'Dejar cuenta abierta',
      input: 'text',
      inputLabel: 'Nombre del Cliente / Mesa',
      inputPlaceholder: 'Ej: Mesa 3, Juan Pérez',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      inputValidator: (value) => (!value?.trim() ? 'Ingresá un nombre' : undefined),
    }).then((result) => {
      if (!result.isConfirmed) return;
      const customerName = (result.value as string).trim();
      this.salesService
        .createOpen(
          customerName,
          this.cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )
        .subscribe({
          next: () => {
            this.cart = [];
            this.draftService.clearDraft(this.DRAFT_KEY_CART);
            this.checkoutStep = 1;
            this.desktopStep = 1;
            this.isMobileCartOpen = false;
            this.toast.success('Cuenta abierta', `Se guardó para ${customerName}`);
            this.loadOpenSales();
          },
          error: () => this.toast.error('Error', 'No se pudo dejar la cuenta abierta'),
        });
    });
  }

  /** Elimina diacríticos (tildes) para comparación insensible a acentos. */
  private normalize(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Recalcula `filteredProducts` a partir del estado actual de `products` y `searchQuery`.
   * Llamar explícitamente en lugar de usar un getter evita que Angular recorra
   * el array entero en cada ciclo de detección de cambios.
   */
  private applyFilter(): void {
    const base = this.searchQuery.trim()
      ? (() => {
          const q = this.normalize(this.searchQuery);
          return this.products.filter((p) =>
            this.normalize(p.name).includes(q),
          );
        })()
      : this.products;

    this.filteredProducts = [...base].sort((a, b) => {
      const aOut = !this.isRental(a) && a.stock <= 0 ? 1 : 0;
      const bOut = !this.isRental(b) && b.stock <= 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
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

  /** Registra la posición vertical inicial del toque para detectar swipe en mobile. */
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.changedTouches[0].screenY;
    this.touchEndY = 0;
  }

  /** Evalúa el gesto de swipe hacia abajo para cerrar el bottom sheet del carrito en mobile. */
  onTouchEnd(): void {
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

  /** Devuelve las clases de color (bg + text) para el badge de categoría en la tarjeta del POS. */
  categoryColor(product: Product): { bg: string; text: string } {
    return getCategoryColor(product.category?.name ?? '');
  }

  /** `true` si el producto/ítem tiene stock bajo el mínimo (y no es alquiler). */
  isLowStockProduct(product: Product): boolean {
    return (
      !this.isRental(product) &&
      product.stock > 0 &&
      product.stock < (product.minStock ?? 0)
    );
  }

  /** `true` si el ítem del carrito tiene stock bajo el mínimo (y no es alquiler). */
  isLowStockItem(item: PosCartItem): boolean {
    return !this.isRental(item) && item.stock > 0 && item.stock < item.minStock;
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

    if (!rental && existing && existing.quantity >= product.stock) {
      this.toast.error(
        'Límite de stock alcanzado',
        `Ya tenés ${product.stock} unidad${product.stock !== 1 ? 'es' : ''} de "${product.name}" en el carrito`,
      );
      return;
    }

    const existingIndex = this.cart.findIndex(
      (i) => i.productId === product.id,
    );

    if (existingIndex !== -1) {
      if (rental || this.cart[existingIndex].quantity < product.stock) {
        const item = this.cart.splice(existingIndex, 1)[0];
        item.quantity += 1;
        this.cart.push(item);
      } else {
        this.toast.error(
          'Stock insuficiente',
          `Solo hay ${product.stock} unidades disponibles`,
        );
      }
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        salePrice: product.salePrice,
        stock: product.stock,
        minStock: product.minStock ?? 0,
        category: product.category?.name ?? '',
        quantity: 1,
      });
    }

    this.triggerCartDraftSave();

    this.toastMessage = `+1 ${product.name}`;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = null;
    }, 1500);

    setTimeout(() => this.scrollCartsToBottom(), 0);
  }

  /** Desplaza todos los contenedores de carrito al final para mostrar el ítem recién agregado. */
  private scrollCartsToBottom(): void {
    this.cartScrollContainers.forEach((ref) => {
      const el = ref.nativeElement as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });
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
      this.triggerCartDraftSave();
    }
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
    this.triggerCartDraftSave();
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
    if (!this.isCashRegisterOpen) {
      Swal.fire({
        title: '¡Caja Cerrada!',
        text: 'Necesitas abrir un turno en la caja para poder registrar ventas o cobros.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ir a Abrir Caja',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5',
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/app/cash-register']);
        }
      });
      return;
    }

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

    const totalStr = this.fmt(this.total);

    const request$ = this.isEditingOpenAccount
      ? this.salesService.pay(this.activeSaleId!, {
          amountCash: this.efectivo,
          amountTransfer: this.transferencia,
        })
      : this.salesService.create({
          items: this.cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          amountCash: this.efectivo,
          amountTransfer: this.transferencia,
          ...(this.customerName.trim() && {
            customerName: this.customerName.trim(),
          }),
        } as CreateSaleDto);

    this.isSubmitting = true;
    request$
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (sale) => {
          this.draftService.clearDraft(this.DRAFT_KEY_CART);
          this.cart = [];
          this.customerName = '';
          this.montoEfectivo = '';
          this.montoTransferencia = '';
          this.activeSaleId = null;
          this.activeSaleCustomerName = null;
          this.originalCartSnapshot = [];
          this.isMobileCartOpen = false;
          this.checkoutStep = 1;
          this.desktopStep = 1;
          this.lastSaleId = sale.id;
          this.productsService.clearCache();
          this.loadProducts();
          this.loadOpenSales();
          this.toast.success(
            'Venta confirmada',
            `Se procesó una venta por $${totalStr}`,
          );
        },
        error: (err) => {
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
            const errMsg =
              err.error?.message ?? 'Error desconocido al procesar la venta';
            this.toast.error('Error al procesar venta', errMsg);
          }
        },
      });
  }
}
