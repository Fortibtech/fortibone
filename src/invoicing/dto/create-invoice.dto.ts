import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({
    description: "Date d'échéance de la facture (format YYYY-MM-DD)",
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
