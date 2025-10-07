// src/wallet/dto/deposit.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodEnum } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive } from 'class-validator';

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
}
