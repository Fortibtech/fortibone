import { ApiProperty } from '@nestjs/swagger';
import { OrderLineStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderLineStatusDto {
  @ApiProperty({ enum: OrderLineStatus })
  @IsEnum(OrderLineStatus)
  status: OrderLineStatus;
}