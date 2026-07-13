import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { Product, CreateProductDto } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { getCategoryColor } from '../../core/utils/category-colors';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ModalScrollLockDirective } from '../../shared/modal-scroll-lock.directive';
import { DisableScrollDirective } from '../../shared/directives/disable-scroll.directive';

interface ProductForm {
  name: string;
  category: string;
  costPrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  isFeatured: boolean;
  icon: string;
}

const ICON_OPTIONS = [
  { value: 'water_bottle', label: 'Bebidas / Gatorade' },
  { value: 'lunch_dining', label: 'Comida / Sándwiches' },
  { value: 'sports_tennis', label: 'Paletas / Deporte' },
  { value: 'apparel', label: 'Indumentaria' },
  { value: 'inventory_2', label: 'Otro / Genérico' },
];

/** Devuelve el icono sugerido según palabras clave del nombre de categoría. */
function iconForCategory(categoryName: string): string {
  const n = categoryName.toLowerCase();
  if (
    /bebida|agua|gatorade|jugo|isotónico|isotonico|refresco|energizante|soda/.test(
      n,
    )
  )
    return 'water_bottle';
  if (/comida|sandwich|sándwich|snack|lunch|alimento|food/.test(n))
    return 'lunch_dining';
  if (/paleta|raqueta|alquiler|pelota|deporte|sport|equipo/.test(n))
    return 'sports_tennis';
  if (/ropa|indumentaria|remera|camiseta|short|calzado|apparel/.test(n))
    return 'apparel';
  return 'inventory_2';
}

const ICON_COLORS: Record<string, { bg: string; text: string }> = {
  water_bottle: { bg: 'bg-sky-100', text: 'text-sky-600' },
  lunch_dining: { bg: 'bg-amber-100', text: 'text-amber-600' },
  sports_tennis: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  apparel: { bg: 'bg-violet-100', text: 'text-violet-600' },
  inventory_2: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

type DialogMode = 'create' | 'edit' | 'view';

@Component({
    selector: 'app-products',
    templateUrl: './products.component.html',
    imports: [
        NgIf,
        ReactiveFormsModule,
        FormsModule,
        NgFor,
        NgClass,
        ModalScrollLockDirective,
        DisableScrollDirective,
    ],
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  /** Categorías cargadas desde el backend — no derivadas de los productos. */
  categories: { id: string; name: string }[] = [];
  searchQuery = '';
  filterCategory = '';
  filterStock: '' | 'low' | 'zero' = '';
  isLoading = false;
  isSubmitting = false;
  deletingId: string | null = null;
  /** ID del producto que debe resaltarse al llegar desde el buscador. */
  highlightedProductId: string | null = null;
  /** IDs de productos cuyo toggle está siendo procesado (evita doble click). */
  togglingFeaturedIds = new Set<string>();

  isDialogOpen = false;
  dialogMode: DialogMode = 'create';
  editingProductId: string | null = null;
  form: ProductForm = this.emptyForm();

  newCategoryName = '';
  /** Opciones de iconos predefinidas para el selector del formulario. */
  readonly iconOptions = ICON_OPTIONS;
  /** Mapa de colores expuesto al template para el preview del modal. */
  readonly ICON_COLORS = ICON_COLORS;
  /** Campos que fueron "tocados" para mostrar errores inline. */
  formTouched = {
    name: false,
    category: false,
    salePrice: false,
    costPrice: false,
    stock: false,
  };

  /** `true` cuando el usuario seleccionó "Nueva categoría" en el selector. */
  get isNewCategory(): boolean {
    return this.form.category === '__nueva__';
  }

  /**
   * `true` cuando la categoría seleccionada (o la nueva ingresada) es "Alquileres".
   * En ese caso costPrice y stock no son requeridos y se fuerzan a 0.
   */
  get isRentalCategory(): boolean {
    if (this.isNewCategory) {
      return this.newCategoryName.trim().toLowerCase().includes('alquiler');
    }
    const cat = this.categories.find((c) => c.id === this.form.category);
    return (cat?.name ?? '').toLowerCase().includes('alquiler');
  }

  /**
   * `true` cuando el producto pertenece a la categoría "Alquileres".
   * Usado en la tabla para mostrar ∞ en lugar del stock numérico.
   */
  isRentalProduct(product: Product): boolean {
    return (product.category?.name ?? '').toLowerCase().includes('alquiler');
  }

  /** Llamado desde el template cuando el select de categoría cambia. */
  onCategoryChange(): void {
    if (this.isRentalCategory) {
      this.form.costPrice = '0';
      this.form.stock = '0';
    }

    const categoryName = this.isNewCategory
      ? this.newCategoryName.trim()
      : (this.categories.find((c) => c.id === this.form.category)?.name ?? '');
    if (categoryName) {
      this.form.icon = iconForCategory(categoryName);
    }

    this.formTouched.category = true;
  }

  /** Marca un campo como tocado para activar la validación visual. */
  touchField(
    field: 'name' | 'category' | 'salePrice' | 'costPrice' | 'stock',
  ): void {
    this.formTouched[field] = true;
  }

  /** Resetea el estado de touched junto con el formulario. */
  private resetTouched(): void {
    this.formTouched = {
      name: false,
      category: false,
      salePrice: false,
      costPrice: false,
      stock: false,
    };
  }

  constructor(
    private productsService: ProductsService,
    private authService: AuthService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();

    const highlightId = this.route.snapshot.queryParamMap.get('highlight');
    if (highlightId) {
      this.scrollAndHighlight(highlightId);
    }
  }

  /** Desplaza la vista hasta el producto con el id dado y lo resalta brevemente. */
  private scrollAndHighlight(id: string): void {
    const attempt = (retries: number) => {
      const el = document.getElementById(`product-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.highlightedProductId = id;
        setTimeout(() => {
          this.highlightedProductId = null;
        }, 3000);
      } else if (retries > 0) {
        setTimeout(() => attempt(retries - 1), 200);
      }
    };
    attempt(10);
  }

  /** Carga las categorías desde el backend independientemente de los productos. */
  private loadCategories(): void {
    this.productsService.getCategories().subscribe({
      next: (cats) => (this.categories = cats),
      error: () => {
        this.toast.error('Aviso', 'No se pudieron cargar las categorías');
      },
    });
  }

  /** `true` cuando el usuario no es administrador y sólo puede ver los productos. */
  get isReadOnly(): boolean {
    return !this.authService.isAdmin;
  }

  /** `true` cuando el diálogo está en modo de sólo lectura. */
  get viewMode(): boolean {
    return this.dialogMode === 'view';
  }

  /** Cantidad total de productos en el inventario. */
  get totalProducts(): number {
    return this.products.length;
  }

  /** Valor total del inventario calculado como suma de (precio venta × stock). */
  get totalInventoryValue(): number {
    return this.products.reduce((sum, p) => sum + p.salePrice * p.stock, 0);
  }

  /** Cantidad de productos marcados como destacados. */
  get featuredCount(): number {
    return this.products.filter((p) => p.isFeatured).length;
  }

  /**
   * `true` si el producto tiene control de stock (minStock > 0) y está agotado.
   * Productos con minStock = 0 son de stock ilimitado y no generan alerta.
   */
  isOutOfStock(product: Product): boolean {
    return product.minStock > 0 && product.stock === 0;
  }

  /**
   * `true` si el producto tiene control de stock (minStock > 0),
   * tiene unidades disponibles pero llegó al umbral de alerta.
   */
  isLowStock(product: Product): boolean {
    return (
      product.minStock > 0 &&
      product.stock > 0 &&
      product.stock <= product.minStock
    );
  }

  /** Cantidad de productos activos con stock = 0 y minStock > 0. */
  get outOfStockCount(): number {
    return this.products.filter((p) => this.isOutOfStock(p)).length;
  }

  /** Cantidad de productos activos con stock en umbral de alerta (sin agotados). */
  get lowStockCount(): number {
    return this.products.filter((p) => this.isLowStock(p)).length;
  }

  /** Devuelve los productos filtrados por búsqueda, categoría y estado de stock. */
  get filteredProducts(): Product[] {
    let list = this.products;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (this.filterCategory) {
      list = list.filter((p) => p.category?.id === this.filterCategory);
    }

    if (this.filterStock === 'zero') {
      list = list.filter((p) => this.isOutOfStock(p));
    } else if (this.filterStock === 'low') {
      list = list.filter((p) => this.isLowStock(p));
    }

    return list;
  }

  /** Resetea todos los filtros activos. */
  clearFilters(): void {
    this.searchQuery = '';
    this.filterCategory = '';
    this.filterStock = '';
  }

  /** `true` cuando hay al menos un filtro activo distinto del valor por defecto. */
  get hasActiveFilters(): boolean {
    return (
      !!this.searchQuery.trim() || !!this.filterCategory || !!this.filterStock
    );
  }

  /** Título del diálogo según el modo activo. */
  get dialogTitle(): string {
    if (this.viewMode) return 'Detalles del Producto';
    return this.editingProductId ? 'Editar Producto' : 'Agregar Producto';
  }

  /** Descripción del diálogo según el modo activo. */
  get dialogDescription(): string {
    if (this.viewMode) return 'Información del producto';
    return this.editingProductId
      ? 'Modifique los datos del producto existente'
      : 'Complete la información del nuevo producto';
  }

  /** Etiqueta del botón de submit según si se está creando o editando. */
  get submitLabel(): string {
    return this.editingProductId ? 'Guardar Cambios' : 'Agregar Producto';
  }

  /**
   * Carga todos los productos desde el servidor y los asigna al estado local.
   */
  private loadProducts(): void {
    this.isLoading = true;
    this.productsService
      .findAll()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (products) => {
          this.products = products;
        },
        error: () => {
          this.toast.error(
            'Error al cargar productos',
            'Intente recargar la página',
          );
        },
      });
  }

  /** Abre el diálogo en modo creación con el formulario vacío. */
  openCreate(): void {
    this.dialogMode = 'create';
    this.editingProductId = null;
    this.newCategoryName = '';
    this.form = this.emptyForm();
    this.resetTouched();
    this.isDialogOpen = true;
  }

  /**
   * Abre el diálogo en modo edición pre-cargando los datos del producto.
   * @param product - Producto a editar.
   */
  openEdit(product: Product): void {
    this.dialogMode = 'edit';
    this.editingProductId = product.id;
    this.newCategoryName = '';
    this.form = {
      name: product.name,
      category: product.category?.id ?? '',
      costPrice: product.costPrice?.toString() ?? '',
      salePrice: product.salePrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock?.toString() ?? '5',
      isFeatured: product.isFeatured,
      icon: product.icon || 'inventory_2',
    };
    this.isDialogOpen = true;
  }

  /**
   * Abre el diálogo en modo vista (solo lectura) con los datos del producto.
   * @param product - Producto a visualizar.
   */
  openView(product: Product): void {
    this.dialogMode = 'view';
    this.editingProductId = product.id;
    this.newCategoryName = '';
    this.form = {
      name: product.name,
      category: product.category?.id ?? '',
      costPrice: product.costPrice?.toString() ?? '',
      salePrice: product.salePrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock?.toString() ?? '5',
      isFeatured: product.isFeatured,
      icon: product.icon || 'inventory_2',
    };
    this.isDialogOpen = true;
  }

  /** Cierra el diálogo y limpia el nombre de nueva categoría. */
  closeDialog(): void {
    this.isDialogOpen = false;
    this.newCategoryName = '';
    this.resetTouched();
  }

  /** Cierra el modal de producto al presionar Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  /**
   * Valida el formulario y envía la petición de creación o actualización al servidor.
   * Si se ingresó una nueva categoría, la crea primero y obtiene su ID real.
   * Para la categoría "Alquileres", costPrice y stock no son requeridos (se envían como 0).
   */
  saveProduct(): void {
    this.formTouched = {
      name: true,
      category: true,
      salePrice: true,
      costPrice: true,
      stock: true,
    };

    const rental = this.isRentalCategory;

    if (rental) {
      this.form.costPrice = this.form.costPrice || '0';
      this.form.stock = this.form.stock || '0';
    }

    const categoryValue = this.isNewCategory
      ? this.newCategoryName.trim()
      : this.form.category;

    if (
      !this.form.name.trim() ||
      !categoryValue ||
      !this.form.salePrice ||
      (!rental && !this.form.costPrice) ||
      (!rental && !this.form.stock)
    ) {
      this.toast.error(
        'Error',
        'Por favor complete todos los campos requeridos',
      );
      return;
    }

    this.isSubmitting = true;

    if (this.isNewCategory) {
      this.productsService
        .createCategory(this.newCategoryName.trim())
        .subscribe({
          next: (cat) => {
            if (!this.categories.find((c) => c.id === cat.id)) {
              this.categories = [...this.categories, cat];
            }
            const isRental = cat.name.toLowerCase().includes('alquiler');
            this.doSaveProduct(cat.id, isRental);
          },
          error: () => {
            this.isSubmitting = false;
            this.toast.error('Error al crear categoría', 'Intente nuevamente');
          },
        });
      return;
    }

    this.doSaveProduct(this.form.category, rental);
  }

  /**
   * Ejecuta la petición HTTP de creación o edición del producto.
   * Llamado desde `saveProduct()` una vez que el categoryId está resuelto.
   */
  private doSaveProduct(categoryId: string, rental: boolean): void {
    const dto: CreateProductDto = {
      name: this.form.name.trim(),
      categoryId: categoryId || undefined,
      costPrice: rental ? 0 : parseFloat(this.form.costPrice),
      salePrice: parseFloat(this.form.salePrice),
      stock: rental ? 0 : parseInt(this.form.stock, 10),
      minStock: rental ? 0 : parseInt(this.form.minStock || '5', 10),
      isFeatured: this.form.isFeatured,
      icon: this.form.icon || 'inventory_2',
    };

    const request$ = this.editingProductId
      ? this.productsService.update(this.editingProductId, dto)
      : this.productsService.create(dto);

    request$.pipe(finalize(() => (this.isSubmitting = false))).subscribe({
      next: (saved) => {
        if (this.editingProductId) {
          this.products = this.products.map((p) =>
            p.id === this.editingProductId ? saved : p,
          );
          this.toast.success(
            'Producto actualizado',
            `${saved.name} se actualizó correctamente`,
          );
        } else {
          this.products = [...this.products, saved];
          this.toast.success(
            'Producto agregado',
            `${saved.name} se agregó al inventario`,
          );
        }
        this.products = [...this.products].sort((a, b) =>
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
        );
        this.closeDialog();
      },
      error: (err) => {
        if (err.status === 409) {
          this.toast.error(
            'Ya existe',
            'Un producto con ese nombre ya está registrado',
          );
        } else {
          this.toast.error('Error al guardar', 'Intente nuevamente');
        }
      },
    });
  }

  /**
   * Elimina un producto del inventario.
   * @param product - Producto a eliminar.
   */
  deleteProduct(product: Product): void {
    this.deletingId = product.id;
    this.productsService
      .remove(product.id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          this.products = this.products.filter((p) => p.id !== product.id);
          this.toast.success(
            'Producto eliminado',
            `${product.name} se eliminó del inventario`,
          );
        },
        error: () => {
          this.toast.error('Error al eliminar', 'Intente nuevamente');
        },
      });
  }

  /** Formatea un número usando el locale argentino. */
  fmt(value: number): string {
    return value.toLocaleString('es-AR');
  }

  /** Devuelve las primeras dos letras del nombre en mayúsculas como avatar. */
  initials(name: string): string {
    return name.substring(0, 2).toUpperCase();
  }

  /** Devuelve las clases de color (bg + text) para el icono del producto. */
  iconColor(product: Product): { bg: string; text: string } {
    const key = product.icon || 'inventory_2';
    return ICON_COLORS[key] ?? ICON_COLORS['inventory_2'];
  }

  /** Devuelve las clases de color (bg + text) para el badge de categoría del producto. */
  categoryColor(product: Product): { bg: string; text: string } {
    return getCategoryColor(product.category?.name ?? '');
  }

  /** Alterna el estado de destacado en el formulario (sólo en modo edición/creación). */
  toggleFeatured(): void {
    if (!this.viewMode) this.form.isFeatured = !this.form.isFeatured;
  }

  /**
   * Persiste el cambio de "Destacado" directamente desde la tabla, sin abrir el modal.
   * Usa actualización optimista: cambia el estado local de inmediato y lo revierte si falla.
   */
  persistToggleFeatured(product: Product): void {
    if (this.isReadOnly || this.togglingFeaturedIds.has(product.id)) return;

    const newValue = !product.isFeatured;
    product.isFeatured = newValue;
    this.togglingFeaturedIds.add(product.id);

    this.productsService
      .update(product.id, { isFeatured: newValue })
      .pipe(finalize(() => this.togglingFeaturedIds.delete(product.id)))
      .subscribe({
        next: (saved) => {
          const idx = this.products.findIndex((p) => p.id === saved.id);
          if (idx !== -1) this.products[idx] = saved;
        },
        error: () => {
          product.isFeatured = !newValue;
          this.toast.error(
            'Error al actualizar',
            'No se pudo cambiar el estado Destacado. Intente nuevamente.',
          );
        },
      });
  }

  /** Devuelve un `ProductForm` vacío para inicializar o resetear el formulario. */
  private emptyForm(): ProductForm {
    return {
      name: '',
      category: '',
      costPrice: '',
      salePrice: '',
      stock: '',
      minStock: '5',
      isFeatured: false,
      icon: 'inventory_2',
    };
  }
}
