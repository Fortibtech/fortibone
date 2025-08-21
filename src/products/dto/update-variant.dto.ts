import { PartialType } from '@nestjs/swagger';
import { CreateVariantDto } from './create-variant.dto';

// On ne permet pas de changer les attributs, seulement les infos commerciales
export class UpdateVariantDto extends PartialType(CreateVariantDto) {}
