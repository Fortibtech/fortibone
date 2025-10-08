// src/wallet/dto/deposit.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class DepositDto {
  @ApiProperty({ description: 'Le montant à déposer dans le portefeuille' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: [PaymentMethodEnum.STRIPE, PaymentMethodEnum.MVOLA], // Exclure MANUAL pour les dépôts
    description: 'La méthode de paiement externe à utiliser pour le dépôt',
  })
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;

  @ApiPropertyOptional({
    description:
      "ID de la méthode de paiement créée par le frontend (ex: Stripe's pm_xxx). Requis pour la confirmation automatique.",
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
