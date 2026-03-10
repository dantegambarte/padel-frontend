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

export interface CreateProductDto {
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  isFeatured: boolean;
}

export type UpdateProductDto = Partial<CreateProductDto>;

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  minStock: number;
}
