// src/orders/dto/ship-order.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ShipOrderDto {
  @ApiPropertyOptional({ description: 'Numéro de suivi du colis' })
  @IsOptional()
  @IsString()
  shippingTrackingNumber?: string;

  @ApiProperty({
    description: "Transporteur utilisé pour l'expédition",
    example: 'Express Log',
  })
  @IsString()
  @IsNotEmpty()
  shippingCarrier: string;

  @ApiProperty({
    description: "Date d'expédition (format YYYY-MM-DD)",
    example: '2025-11-17',
  })
  @IsDateString()
  shippingDate: string;

  @ApiPropertyOptional({
    description: 'Date de livraison estimée (format YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;
}
