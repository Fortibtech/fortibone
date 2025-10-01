// src/payments/dto/payment-responses.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodEnum, PaymentStatus, Prisma } from '@prisma/client';
import { OrderResponseDto } from 'src/orders/dto/order-responses.dto'; // Réutiliser le DTO de réponse des commandes

// DTO pour la réponse de la création d'une intention de paiement
export class PaymentIntentResponseDto {
  @ApiPropertyOptional({
    description:
      'Le secret client à utiliser côté frontend pour confirmer le paiement (pour Stripe)',
  })
  clientSecret?: string;

  @ApiPropertyOptional({
    description:
      "L'URL de redirection vers laquelle l'utilisateur doit être envoyé (pour Mvola, banques, etc.)",
  })
  redirectUrl?: string;

  @ApiProperty({
    description:
      "L'ID de la transaction côté fournisseur (ex: pi_xxx pour Stripe)",
  })
  transactionId: string;

  @ApiProperty({
    enum: PaymentStatus,
    description: 'Le statut initial de la transaction (généralement PENDING)',
  })
  status: PaymentStatus;
}

// DTO pour la réponse d'une transaction de paiement
export class PaymentTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: 'number' })
  amount: Prisma.Decimal;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty({ enum: PaymentMethodEnum })
  provider: PaymentMethodEnum;

  @ApiPropertyOptional()
  providerTransactionId?: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Prisma.JsonValue;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  orderId: string;
}

// DTO pour une réponse paginée de transactions de paiement
export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [PaymentTransactionResponseDto] })
  data: PaymentTransactionResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}
