/** A product available for sale at the facility. */
export interface Product {
  id: string;
  name: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
  category?: { id: string; name: string };
}

/** Payload for creating a new product. */
export interface CreateProductDto {
  name: string;
  categoryId?: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  isFeatured: boolean;
}

/** Payload for partially updating an existing product. */
export type UpdateProductDto = Partial<CreateProductDto>;

/** A product whose stock is below the configured minimum threshold. */
export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}
