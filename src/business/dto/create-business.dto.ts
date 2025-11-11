// src/business/dto/create-business.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessType,
  CommerceType,
  PriceRange,
  Civility,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
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
  @ApiPropertyOptional({
    description: "Le code postal de l'entreprise",
    example: '75001',
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

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

  @ApiPropertyOptional({
    example: '12345678901234',
    description: "Numéro SIRET ou identifiant fiscal de l'entreprise",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  siret?: string;

  @ApiPropertyOptional({
    example: 'https://maboutique.com',
    description: "URL du site web de l'entreprise",
  })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: 'Vente au détail de vêtements',
    description: "Secteur d'activité de l'entreprise",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activitySector?: string;

  @ApiPropertyOptional({
    enum: CommerceType,
    example: CommerceType.PHYSICAL,
    description: 'Type de commerce (Physique, Digital, ou Hybride)',
  })
  @IsOptional()
  @IsEnum(CommerceType)
  commerceType?: CommerceType;

  // --- INFORMATIONS GÉNÉRALES ---
  @ApiPropertyOptional({
    description: "Date de création de l'entreprise (format YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  creationDate?: string;

  @ApiPropertyOptional({ description: "Email de contact de l'entreprise" })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ description: "Téléphone de contact de l'entreprise" })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  // --- CONTACT PRINCIPAL ---
  @ApiPropertyOptional({ description: 'Prénom du contact principal' })
  @IsOptional()
  @IsString()
  contactFirstName?: string;

  @ApiPropertyOptional({ description: 'Nom du contact principal' })
  @IsOptional()
  @IsString()
  contactLastName?: string;

  @ApiPropertyOptional({
    enum: Civility,
    description: 'Civilité du contact principal',
  })
  @IsOptional()
  @IsEnum(Civility)
  contactCivility?: Civility;

  @ApiPropertyOptional({
    description: "Fonction du contact principal dans l'entreprise",
  })
  @IsOptional()
  @IsString()
  contactFunction?: string;

  // --- INFORMATIONS MÉTIER ---
  @ApiPropertyOptional({
    type: [String],
    description: 'Liste des catégories de produits proposées',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productCategories?: string[];

  @ApiPropertyOptional({
    enum: PriceRange,
    description: 'Gamme de prix des produits',
  })
  @IsOptional()
  @IsEnum(PriceRange)
  priceRange?: PriceRange;

  @ApiPropertyOptional({
    description: 'Volume de production (ex: "Petite série")',
  })
  @IsOptional()
  @IsString()
  productionVolume?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Liste des zones de livraison',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliveryZones?: string[];

  @ApiPropertyOptional({
    description: 'Délai de livraison moyen (ex: "3-5 jours")',
  })
  @IsOptional()
  @IsString()
  avgDeliveryTime?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Liste des conditions de paiement acceptées',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentConditions?: string[];

  @ApiPropertyOptional({ description: 'Quantité minimale de commande' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  minOrderQuantity?: number;

  @ApiPropertyOptional({ description: 'Échantillon disponible (oui/non)' })
  @IsOptional()
  @IsBoolean()
  sampleAvailable?: boolean;

  // --- PRÉSENTATION & PRÉFÉRENCES ---
  @ApiPropertyOptional({ description: "Description détaillée de l'entreprise" })
  @IsOptional()
  @IsString()
  detailedDescription?: string;

  @ApiPropertyOptional({
    type: 'object',
    example: { facebook: 'url', linkedin: 'url' },
    additionalProperties: { type: 'string' },
    description: 'Liens vers les réseaux sociaux',
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiPropertyOptional({ description: "Références clients de l'entreprise" })
  @IsOptional()
  @IsString()
  clientReferences?: string;
}
