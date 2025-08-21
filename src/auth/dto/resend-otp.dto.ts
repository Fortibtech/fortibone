// src/auth/dto/resend-otp.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

// Énumération pour définir le contexte de la demande
export enum ResendOtpType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export class ResendOtpDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: "L'email de l'utilisateur demandant un nouvel OTP",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: ResendOtpType,
    example: ResendOtpType.EMAIL_VERIFICATION,
    description: "Le contexte pour lequel l'OTP est demandé",
  })
  @IsEnum(ResendOtpType)
  @IsNotEmpty()
  type: ResendOtpType;
}
