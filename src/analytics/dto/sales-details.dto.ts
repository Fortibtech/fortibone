// src/analytics/dto/sales-details.dto.ts
import { ApiProperty } from '@nestjs/swagger';

// DTO pour les ventes par période
export class SalesByPeriodItem {
  @ApiProperty({
    description: 'Libellé de la période (ex: "Janvier 2025", "2025-01-15")',
    example: '2025-01',
  })
  period: string;

  @ApiProperty({
    description: "Chiffre d'affaires total pour cette période",
    example: 1500.5,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Nombre total de produits vendus pour cette période',
    example: 75,
  })
  totalItems: number;
}

// DTO pour les produits les plus vendus
export class TopSellingProductItem {
  @ApiProperty({
    description: 'ID de la variante de produit',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  variantId: string;

  @ApiProperty({ description: 'SKU de la variante', example: 'TSHIRT-M-BLUE' })
  sku: string;

  @ApiProperty({ description: 'Nom du produit', example: 'T-shirt Casual' })
  productName: string;

  @ApiProperty({
    description: 'Image de la variante',
    example: 'https://picsum.photos/seed/tshirt-blue/400/300',
  })
  variantImageUrl: string;

  @ApiProperty({ description: 'Quantité totale vendue', example: 120 })
  totalQuantitySold: number;

  @ApiProperty({
    description: "Chiffre d'affaires généré par cette variante",
    example: 2398.8,
  })
  totalRevenue: number;

  @ApiProperty({
    description:
      "Pourcentage du chiffre d'affaires total de la période généré par cette variante",
    example: 25.5,
  })
  revenuePercentage: number;
}

// DTO pour les ventes par catégorie
export class SalesByProductCategoryItem {
  @ApiProperty({
    description: 'ID de la catégorie',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  categoryId: string;

  @ApiProperty({ description: 'Nom de la catégorie', example: 'Vêtements' })
  categoryName: string;

  @ApiProperty({
    description: "Chiffre d'affaires total pour cette catégorie",
    example: 5000.0,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Nombre total de produits vendus dans cette catégorie',
    example: 300,
  })
  totalItemsSold: number;
}

// DTO de réponse global pour les détails des ventes
export class SalesDetailsDto {
  @ApiProperty({
    type: [SalesByPeriodItem],
    description: 'Ventes agrégées par période',
  })
  salesByPeriod: SalesByPeriodItem[];

  @ApiProperty({
    type: [TopSellingProductItem],
    description: 'Top 10 des produits les plus vendus',
  })
  topSellingProducts: TopSellingProductItem[];

  @ApiProperty({
    type: [SalesByProductCategoryItem],
    description: 'Ventes agrégées par catégorie de produit',
  })
  salesByProductCategory: SalesByProductCategoryItem[];
}
