// src/business/dto/update-business.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateBusinessDto } from './create-business.dto';

// PartialType rend tous les champs de CreateBusinessDto optionnels
export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}