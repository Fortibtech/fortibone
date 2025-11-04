// src/wallet/dto/withdrawal.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WithdrawalMethod {
  STRIPE_PAYOUT = 'STRIPE_PAYOUT',
  KARTAPAY_MOBILE_MONEY = 'KARTAPAY_MOBILE_MONEY',
}

class MobileMoneyDetailsDto {
  @ApiProperty({
    description: 'Numéro de téléphone pour le retrait Mobile Money',
    example: '0321234567',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class WithdrawalDto {
  @ApiProperty({ description: 'Le montant à retirer du portefeuille' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: WithdrawalMethod,
    description: 'La méthode de retrait à utiliser',
  })
  @IsEnum(WithdrawalMethod)
  method: WithdrawalMethod;

  @ApiPropertyOptional({
    description:
      'Détails pour le retrait Mobile Money (requis si method=KARTAPAY_MOBILE_MONEY)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileMoneyDetailsDto)
  mobileMoneyDetails?: MobileMoneyDetailsDto;
}
