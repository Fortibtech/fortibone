// src/orders/dto/query-orders.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '@prisma/client';
import { QueryPaginationDto } from '../../common/dto/query-pagination.dto'; // Assurez-vous du bon chemin
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrdersDto extends QueryPaginationDto {
  // Extend QueryPaginationDto pour search, page, limit
  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Filtrer les commandes par statut',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderType,
    description: 'Filtrer les commandes par type (SALE, PURCHASE, etc.)',
  })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional({ description: 'ID du client ayant passé la commande' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'ID de la variante de produit présente dans la commande',
  })
  @IsOptional()
  @IsString()
  variantId?: string; // Pour filtrer les commandes contenant un produit spécifique

  @ApiPropertyOptional({
    description: 'Date de début de la période de commande (format YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la période de commande (format YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Montant total minimum de la commande' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Montant total maximum de la commande' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}
