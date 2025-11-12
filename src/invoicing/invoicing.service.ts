import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoicePaymentDto } from './dto/add-invoice-payment.dto';
import { InvoiceStatus, Prisma, User } from '@prisma/client';
import { PdfService } from 'src/pdf/pdf.service';
import { UploaderService } from 'src/uploader/uploader.service';
import { Readable } from 'stream';

@Injectable()
export class InvoicingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService, // INJECTER
    private readonly uploaderService: UploaderService, // INJECTER
  ) {}

  private async verifyOrderOwnership(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { business: { select: { ownerId: true } } },
    });
    if (!order) throw new NotFoundException('Commande non trouvée.');
    if (order.business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée sur cette commande.');
    }
    return order;
  }

  async createInvoiceForOrder(
    orderId: string,
    userId: string,
    dto: CreateInvoiceDto,
  ) {
    await this.verifyOrderOwnership(orderId, userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        invoice: true,
        customer: true,
        business: true,
        lines: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (order.invoice) {
      throw new BadRequestException(
        'Une facture existe déjà pour cette commande.',
      );
    }

    // 1. Créer la facture en BDD (sans le pdfUrl pour l'instant)
    const invoice = await this.prisma.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: `INV-${order.orderNumber}`,
        dueDate: new Date(dto.dueDate),
        subTotal: order.subTotal,
        discountAmount: order.discountAmount,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
      },
    });

    // 2. Générer le PDF en mémoire
    const pdfBuffer = await this.pdfService.generateInvoicePdf({
      ...invoice,
      order,
    });

    // 3. Simuler un fichier pour l'UploaderService
    const pdfFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: `facture-${invoice.invoiceNumber}.pdf`,
      mimetype: 'application/pdf',
      fieldname: 'file',
      encoding: '7bit',
      size: pdfBuffer.length,
      stream: new Readable().wrap(Readable.from(pdfBuffer)),
      destination: '', 
      filename: `facture-${invoice.invoiceNumber}.pdf`,
      path: './', // Valeur factice
    };

    // 4. Uploader le PDF et récupérer l'URL
    const { url: pdfUrl } = await this.uploaderService.upload(pdfFile);

    // 5. Mettre à jour la facture avec l'URL du PDF
    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: pdfUrl },
    });
  }

  async findInvoiceByOrder(orderId: string, userId: string) {
    await this.verifyOrderOwnership(orderId, userId);

    return this.prisma.invoice.findUnique({
      where: { orderId },
      include: { payments: true },
    });
  }

  async addPaymentToInvoice(
    invoiceId: string,
    userId: string,
    dto: AddInvoicePaymentDto,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { order: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Facture non trouvée.');
    await this.verifyOrderOwnership(invoice.orderId, userId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Enregistrer le nouveau paiement
      await tx.invoicePayment.create({
        data: {
          invoiceId,
          amountPaid: new Prisma.Decimal(dto.amountPaid),
          paymentMethod: dto.paymentMethod,
          transactionRef: dto.transactionRef,
        },
      });

      // 2. Mettre à jour le statut de la facture
      const totalPaid =
        invoice.payments.reduce((sum, p) => sum + p.amountPaid.toNumber(), 0) +
        dto.amountPaid;

      let newStatus: InvoiceStatus;
      if (totalPaid >= invoice.totalAmount.toNumber()) {
        newStatus = 'PAID';
      } else if (totalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      } else {
        newStatus = invoice.status; // Garder le statut actuel
      }

      return tx.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
        include: { payments: true },
      });
    });
  }
}
