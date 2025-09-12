// src/payments/dto/refund-order.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class RefundOrderDto {
  @ApiPropertyOptional({
    description:
      'Montant à rembourser (laisser vide pour un remboursement complet)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
