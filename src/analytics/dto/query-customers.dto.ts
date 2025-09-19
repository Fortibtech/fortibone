// src/analytics/dto/query-customers.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { QueryPaginationDto } from 'src/common/dto/query-pagination.dto';

export class QueryCustomersDto extends QueryPaginationDto {
  // Hérite de QueryPaginationDto pour search, page, limit
  @ApiPropertyOptional({
    description: "Date de début de la période d'analyse (format YYYY-MM-DD)",
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Date de fin de la période d'analyse (format YYYY-MM-DD)",
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
