// src/invoicing/invoicing.module.ts
import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PdfModule } from 'src/pdf/pdf.module'; // Importer
import { UploaderModule } from 'src/uploader/uploader.module'; // Importer

@Module({
  imports: [PrismaModule, PdfModule, UploaderModule], // AJOUTER
  controllers: [InvoicingController],
  providers: [InvoicingService],
})
export class InvoicingModule {}
