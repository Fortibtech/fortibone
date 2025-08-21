// src/business/dto/create-business.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({
    example: 'Mon Super Étal',
    description: 'Le nom du commerce, restaurant ou fournisseur',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Le meilleur endroit pour trouver des produits frais et locaux.',
    description: "Une description détaillée de l'entreprise",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: BusinessType,
    example: BusinessType.COMMERCANT,
    description: "Le type d'entreprise",
  })
  @IsEnum(BusinessType)
  type: BusinessType;

  @ApiPropertyOptional({
    example: '123 Rue Principale, 75001 Paris, France',
    description: "L'adresse physique de l'entreprise",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: '+33123456789',
    description: "Le numéro de téléphone de contact de l'entreprise",
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: "URL du logo de l'entreprise",
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/cover.jpg',
    description: "URL de l'image de couverture",
  })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    example: 48.8566,
    description: "Latitude du point de localisation de l'entreprise",
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: 2.3522,
    description: "Longitude du point de localisation de l'entreprise",
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 'clw9a1b2c0000d4t6efgh1234',
    description:
      "L'ID de la devise à associer à l'entreprise. Par défaut : EUR.",
  })
  @IsOptional()
  @IsString() // On pourrait créer un custom validator pour vérifier que l'ID existe
  currencyId?: string;
}
