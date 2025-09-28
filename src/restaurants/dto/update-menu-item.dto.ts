import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class UpdateMenuItemDto {
  @ApiProperty({ description: "Nouvelle quantité de l'article dans le menu" })
  @IsInt()
  @IsPositive()
  quantity: number;
}
