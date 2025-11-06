// src/wallet/dto/transfer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class TransferDto {
  @ApiProperty({
    description:
      "Le montant à transférer (dans la devise du portefeuille de l'expéditeur)",
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: "L'email ou l'ID de l'utilisateur destinataire" })
  @IsString()
  @IsNotEmpty()
  recipientIdentifier: string; // Peut être un email ou un userId
}
