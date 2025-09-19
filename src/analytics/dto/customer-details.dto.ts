// src/analytics/dto/customer-details.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO pour un client précieux
export class TopCustomerItem {
  @ApiProperty({
    description: 'ID du client',
    example: 'clw9a1b2c0000d4t6efgh1234',
  })
  customerId: string;

  @ApiProperty({ description: 'Prénom du client', example: 'Alice' })
  firstName: string;

  @ApiPropertyOptional({
    description: 'Nom de famille du client',
    example: 'Client',
  })
  lastName?: string;

  @ApiProperty({
    description: "URL de l'image de profil du client",
    example: 'https://picsum.photos/seed/alice/150/150',
  })
  profileImageUrl: string;

  @ApiProperty({
    description: 'Nombre total de commandes passées par ce client',
    example: 15,
  })
  totalOrdersPlaced: number;

  @ApiProperty({
    description: 'Montant total dépensé par ce client',
    example: 1500.75,
  })
  totalAmountSpent: number;
}

// DTO de réponse global pour les statistiques client
export class CustomerDetailsDto {
  @ApiProperty({
    type: [TopCustomerItem],
    description: 'Liste des meilleurs clients (paginée)',
  })
  topCustomers: TopCustomerItem[];

  @ApiProperty({ description: 'Nombre total de pages pour les clients' })
  totalPages: number;

  @ApiProperty({ description: 'Nombre total de clients correspondants' })
  total: number;

  @ApiProperty({ description: 'Numéro de la page actuelle' })
  page: number;

  @ApiProperty({ description: "Nombre d'éléments par page" })
  limit: number;
}
