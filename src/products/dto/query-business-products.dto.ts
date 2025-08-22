// src/products/dto/query-product-list.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { QueryPaginationDto } from '../../common/dto/query-pagination.dto';

export class QueryProductListDto extends QueryPaginationDto {
  @ApiPropertyOptional({ description: 'Filtrer par ID de catégorie' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
