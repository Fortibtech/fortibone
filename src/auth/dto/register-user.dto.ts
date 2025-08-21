import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDateString,
} from 'class-validator';
import { ProfileType, Gender } from '@prisma/client';

export class RegisterUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: "Adresse email unique de l'utilisateur",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: "Mot de passe de l'utilisateur (minimum 8 caractères)",
  })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  password: string;

  @ApiProperty({
    example: 'John',
    description: "Prénom de l'utilisateur",
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: "Nom de famille de l'utilisateur",
    required: false,
  })
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '+33612345678',
    description: "Numéro de téléphone de l'utilisateur",
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: '1995-10-24',
    description: "Date de naissance de l'utilisateur (format YYYY-MM-DD)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'France',
    description: "Pays de résidence de l'utilisateur",
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    example: 'Paris',
    description: "Ville de résidence de l'utilisateur",
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
    description: "Sexe de l'utilisateur",
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    enum: ProfileType,
    example: ProfileType.PARTICULIER,
    description: 'Type de profil à la création (PARTICULIER ou PRO)',
  })
  @IsEnum(ProfileType)
  profileType: ProfileType;

   @ApiPropertyOptional({
    description: "Token d'invitation reçu par e-mail (optionnel)",
  })
  @IsOptional()
  @IsString()
  invitationToken?: string;
}
