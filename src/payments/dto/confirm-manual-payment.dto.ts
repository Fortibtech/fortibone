// src/payments/dto/confirm-manual-payment.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject, IsString, IsNotEmpty } from 'class-validator';

export class ConfirmManualPaymentDto {
  @ApiPropertyOptional({
    description:
      "Référence du paiement (ex: numéro de virement, nom de l'agent)",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentReference?: string;

  @ApiPropertyOptional({
    description: 'Détails additionnels du paiement manuel (JSON)',
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
