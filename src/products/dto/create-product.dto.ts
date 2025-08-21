// src/products/dto/create-product.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesUnit } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Le nom du produit',
    example: 'T-shirt Logo FortiBone',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Description détaillée du produit' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "L'ID de la catégorie à laquelle ce produit appartient",
  })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    enum: SalesUnit,
    description:
      "Définit si le produit est vendu à l'unité ou en lot (pour les fournisseurs)",
    default: SalesUnit.UNIT,
  })
  @IsEnum(SalesUnit)
  salesUnit: SalesUnit;
}
