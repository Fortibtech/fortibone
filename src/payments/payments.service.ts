// src/payments/payments.service.ts
import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, PaymentMethodEnum, PaymentStatus, Prisma, User } from '@prisma/client';
import { PaymentProvider, PaymentIntentResult, RefundResult } from './interfaces/payment-provider.interface';
import { OrdersService } from 'src/orders/orders.service'; // Nous aurons besoin du service des commandes

@Injectable()
export class PaymentsService {
  private paymentProviders: Map<PaymentMethodEnum, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('PAYMENT_PROVIDERS_MAP') paymentProvidersMap: Map<PaymentMethodEnum, PaymentProvider>,
    @Inject(forwardRef(() => OrdersService)) // Pour résoudre la dépendance circulaire
    private readonly ordersService: OrdersService,
  ) {
    this.paymentProviders = paymentProvidersMap;
  }
  
  private getProvider(method: PaymentMethodEnum): PaymentProvider {
    const provider = this.paymentProviders.get(method);
    if (!provider) {
      throw new BadRequestException(`Le fournisseur de paiement "${method}" n'est pas configuré.`);
    }
    return provider;
  }

  async createPayment(
    orderId: string,
    user: User,
    method: PaymentMethodEnum,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { business: { include: { currency: true } } },
      });

      if (!order) {
        throw new NotFoundException('Commande non trouvée.');
      }
      if (order.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException(`La commande n'est pas en attente de paiement (statut actuel: ${order.status}).`);
      }
      if (order.customerId !== user.id) {
        throw new ForbiddenException('Vous n\'êtes pas autorisé à payer cette commande.');
      }

      // Déleguer à l'implémentation spécifique du fournisseur
      const provider = this.getProvider(method);
      const result = await provider.createPaymentIntent(order, user, tx, metadata);

      // Mettre à jour l'ordre avec les infos de l'intent
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: method,
          paymentIntentId: result.transactionId,
        },
      });

      // Créer l'entrée de transaction de paiement
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          currencyCode: order.business.currency.code,
          provider: method,
          providerTransactionId: result.transactionId,
          status: result.status,
          metadata,
        },
      });

      return result;
    });
  }

  async confirmManualPayment(
    orderId: string,
    adminUser: User, // Un utilisateur admin ou propriétaire
    details?: any,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { business: { select: { ownerId: true } } },
      });

      if (!order) throw new NotFoundException('Commande non trouvée.');
      if (order.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException(`La commande n'est pas en attente de paiement manuel (statut actuel: ${order.status}).`);
      }
      // Vérifier que l'utilisateur est admin ou propriétaire de l'entreprise
      if (adminUser.profileType !== ProfileType.ADMIN && order.business.ownerId !== adminUser.id) {
        throw new ForbiddenException('Vous n\'êtes pas autorisé à confirmer ce paiement manuel.');
      }

      const provider = this.getProvider(PaymentMethodEnum.MANUAL);
      const transaction = await provider.confirmManualPayment(order, adminUser, tx, details);

      // Mettre à jour la commande après confirmation manuelle
      return this.ordersService.updateOrderStatusLogic(tx, order.id, 'PAID', transaction.id);
    });
  }
  
  async processWebhook(
    providerMethod: PaymentMethodEnum,
    payload: any,
    signature?: string,
  ): Promise<any> {
    // NOTE: Cette logique sera enrichie quand nous aurons des fournisseurs concrets
    // Pour l'instant, c'est un placeholder.
    console.log(`Webhook received for ${providerMethod}`, payload);
    const provider = this.getProvider(providerMethod);
    const result = await provider.handleWebhook(payload, signature);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findUnique({
        where: { providerTransactionId: result.transactionId },
      });
      if (!transaction) {
        throw new NotFoundException(`Transaction de paiement ${result.transactionId} non trouvée.`);
      }

      // Mettre à jour la transaction
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: result.status, metadata: result.metadata },
      });

      // Mettre à jour le statut de la commande si le paiement est un succès
      if (result.status === 'SUCCESS') {
        return this.ordersService.updateOrderStatusLogic(tx, result.orderId, 'PAID', transaction.id);
      } else if (result.status === 'FAILED') {
        return this.ordersService.updateOrderStatusLogic(tx, result.orderId, 'PAYMENT_FAILED');
      } else if (result.status === 'REFUNDED') {
        return this.ordersService.updateOrderStatusLogic(tx, result.orderId, 'REFUNDED');
      }
      return { message: 'Webhook processed, but no order status change triggered.' };
    });
  }

  async refundOrder(
    orderId: string,
    adminUser: User,
    amount?: number,
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          business: { select: { ownerId: true } },
        },
      });

      if (!order) throw new NotFoundException('Commande non trouvée.');
      // Vérifier que l'utilisateur est admin ou propriétaire de l'entreprise
      if (adminUser.profileType !== ProfileType.ADMIN && order.business.ownerId !== adminUser.id) {
        throw new ForbiddenException('Vous n\'êtes pas autorisé à rembourser cette commande.');
      }
      if (order.status !== 'PAID') {
        throw new BadRequestException('Seules les commandes payées peuvent être remboursées.');
      }

      const lastPaymentTransaction = order.payments[0];
      if (!lastPaymentTransaction) {
        throw new BadRequestException('Aucune transaction de paiement trouvée pour cette commande.');
      }

      const provider = this.getProvider(lastPaymentTransaction.provider);
      const refundResult = await provider.refundPayment(order, adminUser, amount, tx);

      // Mettre à jour le statut de la commande en fonction du remboursement
      const newOrderStatus = amount && amount < order.totalAmount.toNumber() ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
      return this.ordersService.updateOrderStatusLogic(tx, order.id, newOrderStatus, refundResult.transactionId);
    });
  }
}