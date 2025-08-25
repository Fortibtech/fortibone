// src/orders/dto/update-order-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    description: 'Le nouveau statut de la commande',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}