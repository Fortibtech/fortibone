// src/analytics/dto/query-sales.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum SalesPeriodUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class QuerySalesDto {
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

  @ApiPropertyOptional({
    enum: SalesPeriodUnit,
    description: 'Unité pour la ventilation des ventes par période',
    default: SalesPeriodUnit.MONTH,
  })
  @IsOptional()
  @IsEnum(SalesPeriodUnit)
  unit?: SalesPeriodUnit = SalesPeriodUnit.MONTH;
}
