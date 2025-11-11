// src/orders/dto/order-responses.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderStatus,
  OrderType,
  PaymentMethodEnum,
  Prisma,
} from '@prisma/client';

// DTO pour les informations de base de l'entreprise
class OrderBusinessDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

// DTO pour les informations de base du client
class OrderCustomerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  profileImageUrl?: string;
}

// DTO pour une ligne de commande (OrderLine)
class OrderLineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ type: 'number' }) // Spécifier le type pour Prisma.Decimal
  price: Prisma.Decimal;

  @ApiProperty()
  variantId: string;

  // Vous pouvez ajouter plus de détails sur la variante si nécessaire
  @ApiPropertyOptional()
  variant?: {
    product: {
      name: string;
    };
    imageUrl?: string;
    sku?: string;
  };
}

class OrderStatusHistoryDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;
  @ApiPropertyOptional()
  notes?: string;
  @ApiProperty()
  timestamp: Date;
  @ApiPropertyOptional()
  triggeredBy?: { id: string; firstName: string; };
}

// DTO de réponse pour une commande complète (pour findOne)
export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ enum: OrderType })
  type: OrderType;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ type: 'number' })
  totalAmount: Prisma.Decimal;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ enum: PaymentMethodEnum })
  paymentMethod?: PaymentMethodEnum;

  @ApiPropertyOptional()
  paymentIntentId?: string;

  @ApiPropertyOptional()
  transactionId?: string;

  @ApiPropertyOptional()
  tableId?: string;

  @ApiPropertyOptional()
  reservationDate?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: OrderBusinessDto })
  business: OrderBusinessDto;

  @ApiProperty({ type: OrderCustomerDto })
  customer: OrderCustomerDto;

  @ApiProperty({ type: [OrderLineResponseDto] })
  lines: OrderLineResponseDto[];

  @ApiProperty({ type: [OrderStatusHistoryDto] })
  statusHistory: OrderStatusHistoryDto[];
}

// DTO pour une réponse paginée de commandes
export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  data: OrderResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}
