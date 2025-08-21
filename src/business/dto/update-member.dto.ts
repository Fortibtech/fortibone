// src/business/dto/update-member.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberDto {
  @ApiProperty({
    enum: MemberRole,
    example: MemberRole.ADMIN,
    description: 'Le nouveau rôle du membre',
  })
  @IsEnum(MemberRole)
  role: MemberRole;
}