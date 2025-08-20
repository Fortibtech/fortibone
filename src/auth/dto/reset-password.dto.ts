// src/auth/dto/reset-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: "L'email de l'utilisateur qui réinitialise son mot de passe",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Le code OTP à 6 chiffres reçu par e-mail',
  })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({
    example: 'myNewStrongPassword123',
    description: 'Le nouveau mot de passe (minimum 8 caractères)',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}