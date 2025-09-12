// src/payments/dto/initiate-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsObject,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({
    enum: PaymentMethodEnum,
    description: 'La méthode de paiement à utiliser',
  })
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;

  @ApiPropertyOptional({
    description:
      'ID de la méthode de paiement (ex: pm_xxxxxxxx) généré côté frontend par Stripe. Requis pour la méthode STRIPE.',
  })
  @IsOptional() // Optionnel car non applicable à toutes les méthodes (ex: Mvola)
  @IsString()
  @IsNotEmpty()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description:
      'Métadonnées additionnelles à passer au fournisseur de paiement (JSON)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
