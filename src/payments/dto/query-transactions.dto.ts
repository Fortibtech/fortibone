// src/payments/dto/query-transactions.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum, PaymentStatus } from '@prisma/client';
import { QueryPaginationDto } from '../../common/dto/query-pagination.dto'; // Assurez-vous du bon chemin
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTransactionsDto extends QueryPaginationDto {
  // Hérite de la pagination et du search
  @ApiPropertyOptional({
    enum: PaymentMethodEnum,
    description: 'Filtrer par méthode de paiement',
  })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  method?: PaymentMethodEnum;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filtrer par statut de transaction',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'ID de la commande associée' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Date de début de la période (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la période (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Montant minimum de la transaction' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Montant maximum de la transaction' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;
}
