// src/wallet/dto/review-withdrawal.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewWithdrawalDto {
  @ApiProperty({
    description: 'Approuver (true) ou rejeter (false) la demande de retrait',
  })
  @IsBoolean()
  @IsNotEmpty()
  approve: boolean;

  @ApiPropertyOptional({
    description: 'Raison du rejet ou note administrative',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
