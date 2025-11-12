// src/pdf/pdf.service.ts
import { Injectable } from '@nestjs/common';
import {
  Order,
  User,
  Business,
  OrderLine,
  ProductVariant,
  Product,
  Invoice,
} from '@prisma/client';

import * as PDFDocument from 'pdfkit';

// Type étendu pour les relations
type FullInvoiceData = Invoice & {
  order: Order & {
    customer: User;
    business: Business;
    lines: (OrderLine & { variant: ProductVariant & { product: Product } })[];
  };
};

@Injectable()
export class PdfService {
  constructor() {}

  async generateInvoicePdf(invoiceData: FullInvoiceData): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // --- Contenu du PDF ---

      // En-tête
      doc.fontSize(20).text('FACTURE', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10);
      const business = invoiceData.order.business;
      doc.text(business.name, { align: 'left' });
      doc.text(business.address || '');
      doc.text(business.phoneNumber || '');
      doc.text(business.businessEmail || '');

      doc.text(`Facture #: ${invoiceData.invoiceNumber}`, { align: 'right' });
      doc.text(
        `Date d'émission: ${new Intl.DateTimeFormat('fr-FR').format(invoiceData.issueDate)}`,
        { align: 'right' },
      );
      doc.text(
        `Date d'échéance: ${new Intl.DateTimeFormat('fr-FR').format(invoiceData.dueDate)}`,
        { align: 'right' },
      );
      doc.moveDown(2);

      // Informations du client
      doc.text('Facturé à :', { underline: true });
      const customer = invoiceData.order.customer;
      doc.text(`${customer.firstName} ${customer.lastName || ''}`);
      doc.text(customer.email);
      doc.moveDown(2);

      // Tableau des articles
      const tableTop = doc.y;
      const itemX = 50;
      const qtyX = 350;
      const priceX = 400;
      const totalX = 470;

      doc.font('Helvetica-Bold');
      doc.text('Article', itemX, tableTop);
      doc.text('Qté', qtyX, tableTop, { width: 40, align: 'right' });
      doc.text('Prix Unitaire', priceX, tableTop, {
        width: 60,
        align: 'right',
      });
      doc.text('Total', totalX, tableTop, { width: 70, align: 'right' });
      doc.font('Helvetica');

      let i = 0;
      for (const line of invoiceData.order.lines) {
        const y = tableTop + 25 + i * 25;
        doc.text(line.variant.product.name, itemX, y);
        doc.text(line.quantity.toString(), qtyX, y, {
          width: 40,
          align: 'right',
        });
        doc.text(`${line.price.toFixed(2)} €`, priceX, y, {
          width: 60,
          align: 'right',
        });
        doc.text(
          `${(Number(line.price) * Number(line.quantity)).toFixed(2)} €`,
          totalX,
          y,
          {
            width: 70,
            align: 'right',
          },
        );
        i++;
      }
      doc.moveDown(i + 2);

      // Totaux
      const totalsY = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Sous-total:', 350, totalsY);
      doc.text(`${invoiceData.subTotal.toFixed(2)} €`, 0, totalsY, {
        align: 'right',
      });
      doc.font('Helvetica');

      if (invoiceData.shippingFee.toNumber() > 0) {
        doc.text('Livraison:', 350, doc.y);
        doc.text(`${invoiceData.shippingFee.toFixed(2)} €`, 0, doc.y, {
          align: 'right',
        });
      }
      if (invoiceData.discountAmount.toNumber() > 0) {
        doc.text('Remise:', 350, doc.y);
        doc.text(`- ${invoiceData.discountAmount.toFixed(2)} €`, 0, doc.y, {
          align: 'right',
        });
      }

      doc.moveDown();
      doc.font('Helvetica-Bold');
      doc.fontSize(12).text('Total à Payer:', 350, doc.y);
      doc.text(`${invoiceData.totalAmount.toFixed(2)} €`, 0, doc.y, {
        align: 'right',
      });
      doc.font('Helvetica');

      // Pied de page
      doc.fontSize(8).text('Merci pour votre confiance.', 50, 750, {
        align: 'center',
        width: 500,
      });

      doc.end();
    });
  }
}
