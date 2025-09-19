// src/analytics/dto/business-overview.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class BusinessOverviewDto {
  @ApiProperty({
    description: "Chiffre d'affaires total (ventes complétées)",
    example: 12500.75,
  })
  totalSalesAmount: number;

  @ApiProperty({
    description: 'Nombre total de commandes de vente complétées',
    example: 120,
  })
  totalSalesOrders: number;

  @ApiProperty({
    description: 'Panier moyen des commandes de vente complétées',
    example: 104.17,
  })
  averageOrderValue: number;

  @ApiProperty({
    description: 'Nombre total de produits vendus (unités)',
    example: 550,
  })
  totalProductsSold: number;

  @ApiProperty({
    description:
      "Valeur totale des commandes d'achat complétées (réapprovisionnement)",
    example: 8000.0,
  })
  totalPurchaseAmount: number;

  @ApiProperty({
    description: "Nombre total de commandes d'achat complétées",
    example: 15,
  })
  totalPurchaseOrders: number;

  @ApiProperty({
    description: "Valeur actuelle estimée de l'inventaire",
    example: 32000.5,
  })
  currentInventoryValue: number;

  @ApiProperty({
    description: "Nombre total de membres (employés) dans l'entreprise",
    example: 5,
  })
  totalMembers: number;

  @ApiProperty({
    description:
      'Nombre de clients uniques ayant passé commande auprès de cette entreprise',
    example: 85,
  })
  uniqueCustomers: number;

  @ApiProperty({ description: "Note moyenne de l'entreprise", example: 4.5 })
  averageBusinessRating: number;

  @ApiProperty({
    description: "Nombre total d'avis pour l'entreprise",
    example: 10,
  })
  totalBusinessReviews: number;
}
