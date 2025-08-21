// src/categories/dto/create-attribute.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAttributeDto {
  @ApiProperty({
    example: 'Taille',
    description: "Le nom de l'attribut (ex: Couleur, Matière, Poids)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
