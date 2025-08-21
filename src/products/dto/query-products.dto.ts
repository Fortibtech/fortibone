import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum ProductSortBy {
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  DISTANCE = 'DISTANCE',
  RELEVANCE = 'RELEVANCE',
}

export class QueryProductsDto {
  @ApiPropertyOptional({
    description: 'Terme de recherche (nom, description, SKU)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ID de la catégorie pour filtrer' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: BusinessType,
    description: "Filtrer par type d'entreprise",
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({
    description: 'Prix minimum (dans la devise spécifiée)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Prix maximum (dans la devise spécifiée)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description:
      'Code ISO de la devise du client (ex: USD, XAF). Les prix seront convertis dans cette devise.',
    default: 'EUR',
  })
  @IsOptional()
  @IsString()
  currencyCode?: string = 'EUR';

  @ApiPropertyOptional({
    description: 'Latitude du point central pour la recherche de proximité',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude du point central pour la recherche de proximité',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Rayon de recherche en kilomètres' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radius?: number;

  @ApiPropertyOptional({
    enum: ProductSortBy,
    description: 'Critère de tri',
    default: ProductSortBy.RELEVANCE,
  })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.RELEVANCE;

  @ApiPropertyOptional({ description: 'Numéro de la page', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Nombre d'éléments par page",
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
