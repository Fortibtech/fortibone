// src/products/dto/create-variant.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// Sous-DTO pour définir la valeur d'un attribut
class AttributeValueDto {
  @ApiProperty({
    description: 'ID de l\'attribut de catégorie (ex: ID de "Taille")',
  })
  @IsString()
  @IsNotEmpty()
  attributeId: string;

  @ApiProperty({
    description: 'Valeur de cet attribut (ex: "M", "Bleu")',
    example: 'M',
  })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateVariantDto {
  @ApiProperty({ description: 'Le prix de vente de cette variante' })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ description: "Le prix d'achat de cette variante" })
  @IsNumber()
  @IsPositive()
  purchasePrice: number;

  @ApiProperty({ description: 'La quantité initiale en stock', default: 0 })
  @IsNumber()
  @Min(0)
  quantityInStock: number;

  @ApiPropertyOptional({
    description: 'SKU (Stock Keeping Unit) unique pour cette variante',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'Code-barres de cette variante' })
  @IsOptional()
  @IsString()
  barcode?: string;

  // --- Pour les fournisseurs (vente en LOT) ---
  @ApiPropertyOptional({
    description: "Nombre d'unités par lot (si salesUnit = LOT)",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  itemsPerLot?: number;

  @ApiPropertyOptional({ description: 'Prix du lot (si salesUnit = LOT)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  lotPrice?: number;

  // --- Gestion des attributs ---
  @ApiProperty({
    type: [AttributeValueDto],
    description:
      'Tableau des valeurs pour les attributs dynamiques de la catégorie',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  attributes: AttributeValueDto[];
}
