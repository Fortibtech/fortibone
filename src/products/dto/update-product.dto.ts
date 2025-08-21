// src/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// PartialType rend tous les champs de CreateProductDto optionnels
export class UpdateProductDto extends PartialType(CreateProductDto) {}
