import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class AddInvoicePaymentDto {
  @ApiProperty({ description: 'Montant du paiement enregistré' })
  @IsNumber()
  @IsPositive()
  amountPaid: number;

  @ApiProperty({
    description: 'Méthode de paiement utilisée',
    example: 'Virement Bancaire',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Référence de la transaction externe' })
  @IsOptional()
  @IsString()
  transactionRef?: string;
}
