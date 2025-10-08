// src/wallet/dto/deposit.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';

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
      "Medata additionnel à attacher à l'intention de paiement. Par exemple, 'paymentMethodId' pour Stripe ou un numéro 'phoneNumber' de téléphone pour Mvola(Mobile Money).",
    example: {
      paymentMethodId: 'pm_1JXXXXXX',
      phoneNumber: '+237650428250',
      note: 'Dépôt pour le portefeuille',
    },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
