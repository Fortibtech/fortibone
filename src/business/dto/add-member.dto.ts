// src/business/dto/add-member.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    example: 'employee@example.com',
    description: "L'email de l'utilisateur à ajouter comme membre",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: MemberRole,
    example: MemberRole.MEMBER,
    description: 'Le rôle à assigner au nouveau membre',
  })
  @IsEnum(MemberRole)
  role: MemberRole;
}
