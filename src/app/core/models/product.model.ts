/** Producto disponible para la venta en el establecimiento. */
export interface Product {
  id: string;
  name: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  isFeatured: boolean;
  isActive: boolean;
  icon?: string;
  category?: { id: string; name: string };
}

/** Payload para crear un nuevo producto. */
export interface CreateProductDto {
  name: string;
  categoryId?: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock?: number;
  isFeatured: boolean;
  icon?: string;
}

/** Payload para actualizar parcialmente un producto existente. */
export type UpdateProductDto = Partial<CreateProductDto>;

/** Producto cuyo stock está por debajo del umbral mínimo configurado. */
export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  category?: { id: string; name: string };
}
