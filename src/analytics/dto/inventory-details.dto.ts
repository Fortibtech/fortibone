// src/analytics/dto/inventory-details.dto.ts
import { ApiProperty } from '@nestjs/swagger';

// DTO pour les produits à stock bas
export class LowStockProductItem {
  @ApiProperty({
    description: 'ID de la variante',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  variantId: string;

  @ApiProperty({ description: 'SKU de la variante', example: 'TSHIRT-M-BLUE' })
  sku: string;

  @ApiProperty({ description: 'Nom du produit', example: 'T-shirt Casual' })
  productName: string;

  @ApiProperty({ description: 'Quantité actuelle en stock', example: 5 })
  quantityInStock: number;

  @ApiProperty({ description: "Seuil d'alerte de stock", example: 10 })
  alertThreshold: number;
}

// DTO pour les produits proches de la péremption (réutilise le type de l'InventoryService)
// Ici, nous allons plutôt créer un DTO spécifique pour la réponse de l'AnalyticsModule
export class ExpiringProductItem {
  @ApiProperty({
    description: 'ID du lot',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  batchId: string;

  @ApiProperty({
    description: 'ID de la variante',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  variantId: string;

  @ApiProperty({ description: 'Nom du produit', example: 'T-shirt Casual' })
  productName: string;

  @ApiProperty({ description: 'Quantité dans ce lot', example: 15 })
  quantity: number;

  @ApiProperty({
    description: 'Date de péremption',
    example: '2025-12-31T23:59:59.000Z',
  })
  expirationDate?: Date;
}

// DTO pour les pertes agrégées
export class TotalLossesItem {
  @ApiProperty({
    description: 'Type de mouvement de perte (ex: "LOSS", "EXPIRATION")',
    example: 'EXPIRATION',
  })
  movementType: string;

  @ApiProperty({
    description: 'Quantité totale perdue pour ce type',
    example: 50,
  })
  totalQuantity: number;

  @ApiProperty({
    description: 'Valeur totale estimée des pertes',
    example: 500.0,
  })
  totalValue: number;
}

// DTO de réponse global pour les détails de l'inventaire
export class InventoryDetailsDto {
  @ApiProperty({
    description: "Valeur totale actuelle de l'inventaire",
    example: 32000.5,
  })
  currentInventoryValue: number;

  @ApiProperty({ description: "Nombre total d'unités en stock", example: 1500 })
  totalUnitsInStock: number;

  @ApiProperty({
    type: [LowStockProductItem],
    description: 'Liste des produits à stock bas',
  })
  productsLowStock: LowStockProductItem[];

  @ApiProperty({
    type: [ExpiringProductItem],
    description: 'Liste des produits proches de la péremption',
  })
  expiringProducts: ExpiringProductItem[];

  @ApiProperty({
    type: [TotalLossesItem],
    description: 'Pertes agrégées par type sur la période',
  })
  lossesByMovementType: TotalLossesItem[];
}
