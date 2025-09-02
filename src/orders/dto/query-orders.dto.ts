// src/orders/dto/query-orders.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '@prisma/client';
import { QueryPaginationDto } from '../../common/dto/query-pagination.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryOrdersDto extends QueryPaginationDto {
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
}
