// src/inventory/dto/add-batch.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class AddBatchDto {
  @ApiProperty({ description: 'Quantité de produits reçus dans ce lot' })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Date de péremption du lot (format YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
