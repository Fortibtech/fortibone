// src/restaurants/dto/add-menu-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class AddMenuItemDto {
  @ApiProperty({
    description: 'ID de la variante de produit à ajouter au menu',
  })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({
    default: 1,
    description: 'Quantité de cet article dans le menu',
  })
  @IsInt()
  @IsPositive()
  quantity: number;
}
