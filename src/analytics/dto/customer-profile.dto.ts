// src/analytics/dto/customer-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, Prisma } from '@prisma/client';

export class CustomerBaseInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Première date de commande de ce client auprès de cette entreprise',
  })
  clientSince?: Date;

  // Note: l'adresse complète n'est pas sur le modèle User.
  // On peut la récupérer de la dernière commande ou laisser le frontend la gérer.
  // Pour l'instant, on la laisse de côté.
}

export class CustomerStatsDto {
  @ApiProperty({
    description: "Chiffre d'affaires total généré par ce client",
    example: 2658,
  })
  totalSalesAmount: number;

  @ApiProperty({
    description: 'Nombre total de commandes passées par ce client',
    example: 8,
  })
  totalOrders: number;

  @ApiProperty({ description: 'Panier moyen de ce client', example: 332.25 })
  averageOrderValue: number;

  @ApiPropertyOptional({
    description: 'Date de la dernière commande de ce client',
  })
  lastOrderDate?: Date;
}

export class RecentOrderItemDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  orderDate: Date;

  @ApiProperty({ type: 'number' })
  totalAmount: Prisma.Decimal;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: 'Liste des produits dans cette commande' })
  products: {
    productName: string;
    quantity: number;
  }[];
}

export class CustomerProfileDto {
  @ApiProperty({ type: CustomerBaseInfoDto })
  customerInfo: CustomerBaseInfoDto;

  @ApiProperty({ type: CustomerStatsDto })
  stats: CustomerStatsDto;

  @ApiProperty({
    type: [RecentOrderItemDto],
    description: 'Liste des 5 dernières commandes',
  })
  recentOrders: RecentOrderItemDto[];
}
