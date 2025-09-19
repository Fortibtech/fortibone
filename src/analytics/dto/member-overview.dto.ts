// src/analytics/dto/member-overview.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class MemberOverviewDto {
  @ApiProperty({
    description: "Chiffre d'affaires total des ventes traitées par ce membre",
    example: 5000.0,
  })
  totalSalesProcessed: number;

  @ApiProperty({
    description: 'Nombre total de commandes de vente traitées par ce membre',
    example: 50,
  })
  totalSalesOrdersProcessed: number;

  @ApiProperty({
    description: 'Nombre total de produits vendus (unités) par ce membre',
    example: 250,
  })
  totalProductsSold: number;

  @ApiProperty({
    description: "Nombre total de commandes d'achat initiées par ce membre",
    example: 5,
  })
  totalPurchaseOrdersInitiated: number;

  @ApiProperty({
    description: 'Montant total des achats initiés par ce membre',
    example: 3500.0,
  })
  totalPurchaseAmountInitiated: number;

  @ApiProperty({
    description:
      'Nombre total de réservations gérées par ce membre (si restaurateur)',
    example: 30,
  })
  totalReservationsManaged: number;

  @ApiProperty({
    description:
      "Nombre total d'ajustements d'inventaire effectués par ce membre",
    example: 12,
  })
  totalInventoryAdjustments: number;

  @ApiProperty({
    description:
      'Valeur totale des pertes (LOSS, EXPIRATION) gérées par ce membre',
    example: 200.0,
  })
  totalLossesManaged: number;
}
