// src/orders/dto/update-order.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: 'Notes additionnelles pour la commande' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Nouvelle adresse de livraison (pour les commandes non expédiées)',
  })
  @IsOptional()
  @IsString()
  shippingAddress?: string; // Champ à ajouter dans le modèle Order si nécessaire
}
