import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { ProfileType } from '@prisma/client';

export class RegisterUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Adresse email unique de l\'utilisateur',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Mot de passe de l\'utilisateur (minimum 8 caractères)',
  })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'Prénom de l\'utilisateur',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Nom de famille de l\'utilisateur',
    required: false,
  })
  @IsString()
  lastName?: string;

  @ApiProperty({
    enum: ProfileType,
    example: ProfileType.PARTICULIER,
    description: 'Type de profil à la création (PARTICULIER ou PRO)',
  })
  @IsEnum(ProfileType)
  profileType: ProfileType;
}