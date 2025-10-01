// src/restaurants/dto/restaurant-responses.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

// DTO de réponse pour une table de restaurant
export class RestaurantTableResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  businessId: string;
}

// DTO pour un élément de menu (MenuItem) dans une réponse
class MenuItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  variantId: string;

  // Détails de la variante (plat)
  @ApiPropertyOptional()
  variant?: {
    product: {
      name: string;
    };
    imageUrl?: string;
  };
}

// DTO de réponse pour un menu complet
export class MenuResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: 'number' })
  price: Prisma.Decimal;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [MenuItemResponseDto] })
  menuItems: MenuItemResponseDto[];
}
