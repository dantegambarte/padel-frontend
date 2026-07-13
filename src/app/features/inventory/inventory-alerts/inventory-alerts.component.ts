import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { LowStockProduct } from '../../../core/models/product.model';

@Component({
  standalone: false,
  selector: 'app-inventory-alerts',
  templateUrl: './inventory-alerts.component.html',
})
export class InventoryAlertsComponent implements OnInit {
  allAlerts: LowStockProduct[] = [];
  isLoading = true;

  searchTerm = '';
  selectedCategory = '';

  constructor(
    private productsService: ProductsService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Carga las alertas de stock bajo desde el servidor. */
  private load(): void {
    this.isLoading = true;
    this.productsService.getLowStock().subscribe({
      next: (list) => {
        this.allAlerts = list;
        this.isLoading = false;
      },
      error: () => {
        this.toast.error(
          'Error',
          'No se pudieron cargar las alertas de stock.',
        );
        this.isLoading = false;
      },
    });
  }

  /** Lista de categorías únicas presentes en las alertas, ordenadas alfabéticamente. */
  get categories(): { id: string; name: string }[] {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const p of this.allAlerts) {
      if (p.category && !seen.has(p.category.id)) {
        seen.add(p.category.id);
        result.push(p.category);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Alertas filtradas por texto de búsqueda y categoría seleccionada. */
  get filteredAlerts(): LowStockProduct[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.allAlerts.filter((p) => {
      const matchesName = !term || p.name.toLowerCase().includes(term);
      const matchesCategory =
        !this.selectedCategory || p.category?.id === this.selectedCategory;
      return matchesName && matchesCategory;
    });
  }

  /** Productos con stock en cero. */
  get outOfStock(): LowStockProduct[] {
    return this.filteredAlerts.filter((p) => p.stock === 0);
  }

  /** Productos con stock bajo pero mayor a cero. */
  get lowStock(): LowStockProduct[] {
    return this.filteredAlerts.filter((p) => p.stock > 0);
  }

  /** Indica si hay algún filtro activo (búsqueda o categoría). */
  get hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.selectedCategory !== '';
  }

  /** Limpia búsqueda y categoría seleccionada. */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
  }

  /** Porcentaje de stock restante respecto al mínimo, para la barra de progreso. */
  stockPercent(p: LowStockProduct): number {
    if (p.minStock === 0) return 100;
    return Math.min(100, Math.round((p.stock / p.minStock) * 100));
  }

  /** Navega a la página de productos resaltando el producto dado. */
  goToProduct(p: LowStockProduct): void {
    this.router.navigate(['/app/products'], {
      queryParams: { highlight: p.id },
    });
  }

  /** Recarga las alertas desde el servidor. */
  refresh(): void {
    this.load();
  }
}
