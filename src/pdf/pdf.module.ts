// src/pdf/pdf.module.ts
import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';

@Module({
  providers: [PdfService],
  exports: [PdfService], // Exporter pour que InvoicingModule puisse l'utiliser
})
export class PdfModule {}
