// src/inventory/dto/inventory-responses.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType, Prisma } from '@prisma/client';

// DTO pour un lot de produit (ProductBatch)
export class BatchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional()
  expirationDate?: Date;

  @ApiProperty()
  receivedAt: Date;

  @ApiProperty()
  variantId: string;
}

// DTO pour une réponse paginée de lots
export class PaginatedBatchesResponseDto {
  @ApiProperty({ type: [BatchResponseDto] })
  data: BatchResponseDto[];

  @ApiProperty()
  total: number;
  
  @ApiProperty()
  page: number;
  
  @ApiProperty()
  limit: number;
  
  @ApiProperty()
  totalPages: number;
}

// DTO pour une variante dans une liste d'inventaire
export class InventoryVariantResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  sku?: string;

  @ApiProperty({ type: 'number' })
  price: Prisma.Decimal;
  
  @ApiProperty({ type: 'number' })
  purchasePrice: Prisma.Decimal;

  @ApiProperty()
  quantityInStock: number;
  
  @ApiPropertyOptional()
  product?: {
    name: string;
  };

  // Les attributeValues peuvent aussi être inclus si nécessaire
}

// DTO pour une réponse paginée d'inventaire
export class PaginatedInventoryResponseDto {
  @ApiProperty({ type: [InventoryVariantResponseDto] })
  data: InventoryVariantResponseDto[];
  
  @ApiProperty()
  total: number;
  
  @ApiProperty()
  page: number;
  
  @ApiProperty()
  limit: number;
  
  @ApiProperty()
  totalPages: number;
}

// DTO pour un mouvement de stock (StockMovement)
export class StockMovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: MovementType })
  type: MovementType;

  @ApiProperty()

  quantityChange: number;

  @ApiProperty()
  newQuantity: number;

  @ApiPropertyOptional()
  reason?: string;
  
  @ApiProperty()
  createdAt: Date;
  
  @ApiPropertyOptional()
  performedBy?: {
    id: string;
    firstName: string;
  };
  
  @ApiPropertyOptional()
  order?: {
    id: string;
    orderNumber: string;
  };
}