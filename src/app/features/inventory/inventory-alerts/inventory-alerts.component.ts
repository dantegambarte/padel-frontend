import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { LowStockProduct } from '../../../core/models/product.model';

@Component({
  selector: 'app-inventory-alerts',
  templateUrl: './inventory-alerts.component.html',
})
export class InventoryAlertsComponent implements OnInit {
  allAlerts: LowStockProduct[] = [];
  isLoading = true;

  constructor(
    private productsService: ProductsService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.productsService.getLowStock().subscribe({
      next: (list) => {
        this.allAlerts = list;
        this.isLoading = false;
      },
      error: () => {
        this.toast.error('Error', 'No se pudieron cargar las alertas de stock.');
        this.isLoading = false;
      },
    });
  }

  get outOfStock(): LowStockProduct[] {
    return this.allAlerts.filter((p) => p.stock === 0);
  }

  get lowStock(): LowStockProduct[] {
    return this.allAlerts.filter((p) => p.stock > 0);
  }

  /** Porcentaje de stock restante respecto al umbral mínimo, para la barra de progreso. */
  stockPercent(p: LowStockProduct): number {
    if (p.minStock === 0) return 100;
    return Math.min(100, Math.round((p.stock / p.minStock) * 100));
  }

  goToProduct(p: LowStockProduct): void {
    this.router.navigate(['/app/products'], { queryParams: { highlight: p.id } });
  }

  refresh(): void {
    this.load();
  }
}
