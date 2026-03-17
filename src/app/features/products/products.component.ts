import { Component, HostListener, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { Product, CreateProductDto } from '../../core/models/product.model';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

interface ProductForm {
  name: string;
  category: string;
  costPrice: string;
  salePrice: string;
  stock: string;
  isFeatured: boolean;
}

type DialogMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  searchQuery = '';
  isLoading = false;
  isSubmitting = false;
  deletingId: string | null = null;

  isDialogOpen = false;
  dialogMode: DialogMode = 'create';
  editingProductId: string | null = null;
  form: ProductForm = this.emptyForm();

  newCategoryName = '';

  /** Lista de categorías únicas extraídas del inventario actual. */
  get categories(): { id: string; name: string }[] {
    const seen = new Set<string>();
    return this.products
      .map((p) => p.category)
      .filter(
        (c): c is { id: string; name: string } =>
          !!c && !seen.has(c.id) && seen.add(c.id) !== undefined,
      );
  }

  /** `true` cuando el usuario seleccionó "Nueva categoría" en el selector. */
  get isNewCategory(): boolean {
    return this.form.category === '__nueva__';
  }

  constructor(
    private productsService: ProductsService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
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

  /** Devuelve los productos filtrados por el término de búsqueda actual. */
  get filteredProducts(): Product[] {
    if (!this.searchQuery.trim()) return this.products;
    const q = this.searchQuery.toLowerCase();
    return this.products.filter((p) => p.name.toLowerCase().includes(q));
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
      isFeatured: product.isFeatured,
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
      isFeatured: product.isFeatured,
    };
    this.isDialogOpen = true;
  }

  /** Cierra el diálogo y limpia el nombre de nueva categoría. */
  closeDialog(): void {
    this.isDialogOpen = false;
    this.newCategoryName = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDialogOpen) this.closeDialog();
  }

  /**
   * Valida el formulario y envía la petición de creación o actualización al servidor.
   * Si el usuario eligió "Nueva categoría", omite `categoryId` del DTO (es opcional).
   */
  saveProduct(): void {
    const categoryValue = this.isNewCategory
      ? this.newCategoryName.trim()
      : this.form.category;

    if (
      !this.form.name ||
      !categoryValue ||
      !this.form.costPrice ||
      !this.form.salePrice ||
      !this.form.stock
    ) {
      this.toast.error('Error', 'Por favor complete todos los campos');
      return;
    }

    const dto: CreateProductDto = {
      name: this.form.name,
      ...(this.isNewCategory ? {} : { categoryId: categoryValue }),
      costPrice: parseFloat(this.form.costPrice),
      salePrice: parseFloat(this.form.salePrice),
      stock: parseInt(this.form.stock, 10),
      isFeatured: this.form.isFeatured,
    };

    this.isSubmitting = true;
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

  /** Alterna el estado de destacado en el formulario (sólo en modo edición/creación). */
  toggleFeatured(): void {
    if (!this.viewMode) this.form.isFeatured = !this.form.isFeatured;
  }

  /** Devuelve un `ProductForm` vacío para inicializar o resetear el formulario. */
  private emptyForm(): ProductForm {
    return {
      name: '',
      category: '',
      costPrice: '',
      salePrice: '',
      stock: '',
      isFeatured: false,
    };
  }
}
