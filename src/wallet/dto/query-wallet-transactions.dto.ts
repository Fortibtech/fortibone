// src/wallet/dto/query-wallet-transactions.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WalletTransactionStatus, WalletTransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { QueryPaginationDto } from 'src/common/dto/query-pagination.dto';

export class QueryWalletTransactionsDto extends QueryPaginationDto {
  @ApiPropertyOptional({
    enum: WalletTransactionType,
    description: 'Filtrer par type de transaction (DEPOSIT, PAYMENT, etc.)',
  })
  @IsOptional()
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;

  @ApiPropertyOptional({
    enum: WalletTransactionStatus,
    description: 'Filtrer par statut de transaction (COMPLETED, PENDING, etc.)',
  })
  @IsOptional()
  @IsEnum(WalletTransactionStatus)
  status?: WalletTransactionStatus;

  @ApiPropertyOptional({
    description: 'Date de début de la période (format YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Date de fin de la période (format YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
