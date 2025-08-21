// src/categories/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Vêtements',
    description: 'Le nom unique de la catégorie',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Tous les articles textiles pour hommes, femmes et enfants.',
    description: 'Une description de la catégorie',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/category-image.png',
    description: "URL d'une image représentative pour la catégorie",
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
