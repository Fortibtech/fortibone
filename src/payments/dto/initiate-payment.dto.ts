// src/payments/dto/initiate-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum } from '@prisma/client';
import { IsEnum, IsOptional, IsObject } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({
    enum: PaymentMethodEnum,
    description: 'La méthode de paiement à utiliser',
  })
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;

  @ApiPropertyOptional({
    description:
      'Métadonnées additionnelles à passer au fournisseur de paiement (JSON)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
