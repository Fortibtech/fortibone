// src/inventory/dto/adjust-stock.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const allowedManualMovementTypes = [
  MovementType.ADJUSTMENT,
  MovementType.LOSS,
  MovementType.RETURN,
  MovementType.EXPIRATION,
];

export class AdjustStockDto {
  @ApiProperty({
    description:
      'La quantité à ajouter (nombre positif) ou à retirer (nombre négatif) du stock.',
    example: -2,
  })
  @IsInt()
  @IsNotEmpty()
  quantityChange: number;

  @ApiProperty({
    enum: allowedManualMovementTypes,
    description: 'Le type de mouvement de stock manuel.',
    example: MovementType.LOSS,
  })
  @IsEnum(allowedManualMovementTypes)
  type: MovementType;

  @ApiPropertyOptional({
    description:
      'La raison de l\'ajustement (ex: "Produit endommagé", "Correction d\'inventaire")',
    example: 'Produit endommagé lors du transport',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({
    description:
      "ID du lot spécifique à ajuster. Si non fourni, l'ajustement se fera selon la logique FEFO (First-Expired-First-Out).",
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  @IsOptional()
  @IsString()
  batchId?: string;
}
