// src/users/dto/update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'John',
    description: "Prénom de l'utilisateur",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Doe',
    description: "Nom de famille de l'utilisateur",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({
    example: '+33712345678',
    description: "Numéro de téléphone de l'utilisateur",
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/path/to/profile.jpg',
    description: "URL de l'image de profil",
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    example: '1995-10-24',
    description: 'Date de naissance (format YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'France' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Paris' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
