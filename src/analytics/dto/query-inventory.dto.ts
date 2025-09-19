// src/analytics/dto/query-inventory.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { QueryPaginationDto } from 'src/common/dto/query-pagination.dto'; // Pour la pagination des listes

export class QueryInventoryDto extends QueryPaginationDto {
  // Hérite de QueryPaginationDto
  @ApiPropertyOptional({
    description: "ID de la catégorie pour filtrer l'inventaire",
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Date de début pour l'analyse des mouvements de stock (format YYYY-MM-DD)",
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Date de fin pour l'analyse des mouvements de stock (format YYYY-MM-DD)",
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
