// src/products/dto/create-review.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'Note de 1 à 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Commentaire textuel (max 1000 caractères)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
