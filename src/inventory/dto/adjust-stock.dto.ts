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

// On ne permet que certains types de mouvements manuels
const allowedManualMovementTypes = [
  MovementType.ADJUSTMENT,
  MovementType.LOSS,
  MovementType.RETURN,
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
}
