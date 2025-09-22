// src/analytics/dto/restaurant-details.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PopularDishItem {
  @ApiProperty({
    description: 'ID de la variante de produit (plat)',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  variantId: string;

  @ApiProperty({ description: 'Nom du plat', example: 'Pizza Margherita' })
  dishName: string;

  @ApiProperty({
    description: 'Image du plat',
    example: 'https://picsum.photos/seed/pizza/400/300',
  })
  dishImageUrl: string;

  @ApiProperty({ description: 'Quantité totale commandée', example: 120 })
  totalQuantityOrdered: number;

  @ApiProperty({
    description: "Chiffre d'affaires généré par ce plat",
    example: 2400.0,
  })
  totalRevenue: number;
}

export class ReservationsByPeriodItem {
  @ApiProperty({
    description: 'Libellé de la période (ex: "Janvier 2025")',
    example: '2025-01',
  })
  period: string;

  @ApiProperty({ description: 'Nombre total de réservations', example: 50 })
  totalReservations: number;
}

export class RestaurantDetailsDto {
  @ApiProperty({
    description: 'Nombre total de réservations (sur la période si spécifiée)',
    example: 250,
  })
  totalReservations: number;

  @ApiProperty({
    description:
      'Nombre total de commandes de plats (ventes B2C sur la période)',
    example: 1500,
  })
  totalDishOrders: number;

  @ApiProperty({
    type: [PopularDishItem],
    description: 'Liste des plats les plus populaires',
  })
  popularDishes: PopularDishItem[];

  @ApiProperty({
    type: [ReservationsByPeriodItem],
    description: 'Réservations agrégées par période (par mois par défaut)',
  })
  reservationsByPeriod: ReservationsByPeriodItem[];

  @ApiPropertyOptional({
    description:
      "Taux d'occupation moyen des tables (calcul plus complexe, optionnel)",
    example: 0.75,
  })
  averageTableOccupancy?: number;
}
