// src/inventory/dto/update-batch.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class UpdateBatchDto {
  @ApiPropertyOptional({
    description: 'Nouvelle quantité de produits dans ce lot',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Nouvelle date de péremption du lot (format YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
