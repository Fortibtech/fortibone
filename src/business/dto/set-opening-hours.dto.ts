import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { OpeningHourDto } from './opening-hours.dto';

export class SetOpeningHoursDto {
  @ApiProperty({ type: [OpeningHourDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  hours: OpeningHourDto[];
}
