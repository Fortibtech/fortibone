import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Adresse email de l\'utilisateur pour la connexion',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'Mot de passe de l\'utilisateur',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}