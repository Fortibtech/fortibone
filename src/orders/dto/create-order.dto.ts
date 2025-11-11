// src/orders/dto/create-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// Sous-DTO pour chaque ligne de la commande
class OrderLineDto {
  @ApiProperty({ description: 'ID de la variante de produit commandée' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'Quantité commandée pour cette variante' })
  @IsInt()
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({
    enum: OrderType,
    description:
      'Le type de commande : SALE (B2C), PURCHASE (B2B), ou RESERVATION',
  })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({
    description: "ID de l'entreprise qui reçoit la commande (le vendeur)",
  })
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @ApiPropertyOptional({
    description:
      "Pour un achat B2B (PURCHASE), ID de l'entreprise qui vend (le fournisseur).",
  })
  @IsOptional()
  @IsString()
  supplierBusinessId?: string; // Utilisé pour le type PURCHASE

  @ApiPropertyOptional({ description: 'Notes additionnelles pour la commande' })
  @IsOptional()
  @IsString()
  notes?: string;

  // --- Champs pour les Réservations ---
  @ApiPropertyOptional({
    description: 'Numéro ou nom de la table pour une RESERVATION',
  })
  @IsOptional()
  @IsString()
  tableId?: string;

  @ApiPropertyOptional({
    description: 'Date et heure de la réservation (format ISO-8601)',
    example: '2025-12-24T19:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  reservationDate?: string;

  // --- Lignes de la commande ---
  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  @ApiPropertyOptional({
    description:
      'Spécifie si le paiement de la commande doit être effectué via le portefeuille FortiBone.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean = false;

  @ApiPropertyOptional({ description: 'Frais de livraison pour la commande' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({
    description: 'Montant de la remise appliquée à la commande',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}
