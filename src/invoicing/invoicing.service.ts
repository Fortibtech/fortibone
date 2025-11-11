import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AddInvoicePaymentDto } from './dto/add-invoice-payment.dto';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class InvoicingService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { invoice: true },
    });

    if (order.invoice) {
      throw new BadRequestException(
        'Une facture existe déjà pour cette commande.',
      );
    }

    return this.prisma.invoice.create({
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
