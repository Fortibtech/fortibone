// src/payments/payments.service.ts
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Order,
  OrderStatus,
  PaymentMethodEnum,
  PaymentStatus,
  Prisma,
  WalletTransactionStatus,
  User,
} from '@prisma/client';
import {
  PaymentProvider,
  PaymentIntentResult,
  WebhookResult,
} from './interfaces/payment-provider.interface';
import { OrdersService } from 'src/orders/orders.service'; // Nous aurons besoin du service des commandes
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class PaymentsService {
  private paymentProviders: Map<PaymentMethodEnum, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('PAYMENT_PROVIDERS_MAP')
    paymentProvidersMap: Map<PaymentMethodEnum, PaymentProvider>,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WalletService)) // Gérer la dépendance circulaire
    private readonly walletService: WalletService,
  ) {
    this.paymentProviders = paymentProvidersMap;
  }

  private getProvider(method: PaymentMethodEnum): PaymentProvider {
    const provider = this.paymentProviders.get(method);
    if (!provider) {
      throw new BadRequestException(
        `Le fournisseur de paiement "${method}" n'est pas configuré.`,
      );
    }
    return provider;
  }

  async createPayment(
    orderId: string,
    user: User,
    method: PaymentMethodEnum,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { business: { include: { currency: true } } },
        });

        if (!order) {
          throw new NotFoundException('Commande non trouvée.');
        }
        if (order.status !== 'PENDING_PAYMENT') {
          throw new BadRequestException(
            `La commande n'est pas en attente de paiement (statut actuel: ${order.status}).`,
          );
        }
        if (order.customerId !== user.id) {
          throw new ForbiddenException(
            "Vous n'êtes pas autorisé à payer cette commande.",
          );
        }

        // Déleguer à l'implémentation spécifique du fournisseur
        const provider = this.getProvider(method);
        // CORRECTION ICI : Passer paymentMethodId au provider
        const result = await provider.createPaymentIntent(
          order,
          user,
          tx as any,
          metadata,
        );

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
            currencyCode: order.business.currency?.code || 'EUR',
            provider: method,
            providerTransactionId: result.transactionId,
            status: result.status,
            metadata,
          },
        });

        return result;
      },
      { timeout: 120000 },
    );
  }

  // --- NOUVELLE MÉTHODE GÉNÉRIQUE ---
  async createPaymentIntent(
    amount: number,
    currencyCode: string,
    user: User,
    method: PaymentMethodEnum,
    metadata: Record<string, any>, // Les métadonnées sont maintenant obligatoires pour le contexte
  ) {
    if (!metadata || !metadata.context) {
      throw new BadRequestException(
        "Le contexte de paiement (ex: 'WALLET_DEPOSIT', 'ORDER_PAYMENT') est requis dans les métadonnées.",
      );
    }

    // Convertir le montant en décimal pour la précision
    const decimalAmount = new Prisma.Decimal(amount);

    // Déleguer à l'implémentation spécifique du fournisseur
    const provider = this.getProvider(method);
    const result = await provider.createPaymentIntent(
      {
        totalAmount: decimalAmount,
        business: { currency: { code: currencyCode } },
      } as any,
      user,
      this.prisma,
      metadata,
    );

    // Créer l'entrée de transaction de paiement
    await this.prisma.paymentTransaction.create({
      data: {
        amount: decimalAmount,
        currencyCode: currencyCode,
        provider: method,
        providerTransactionId: result.transactionId,
        status: result.status,
        metadata,
        // orderId peut être ajouté plus tard par le webhook si le contexte est ORDER_PAYMENT
      },
    });

    return result;
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
      if (
        order.status !== 'PENDING_PAYMENT' ||
        order.paymentMethod !== PaymentMethodEnum.MANUAL
      ) {
        throw new BadRequestException(
          `La commande n'est pas en attente de confirmation de paiement manuel.`,
        );
      }
      // La vérification d'autorisation est maintenant faite dans le provider spécifique.
      // Le provider aura besoin de l'objet User complet pour ses vérifications.

      const provider = this.getProvider(PaymentMethodEnum.MANUAL);
      const transaction = await provider.confirmManualPayment(
        order,
        adminUser,
        tx as any,
        details,
      );

      // Mettre à jour la commande après confirmation manuelle
      // La méthode updateOrderStatusLogic s'assurera que le status passe bien à PAID
      return this.ordersService.updateOrderStatusLogic(
        tx,
        order.id,
        OrderStatus.PAID,
        transaction.id,
      );
    });
  }

  async processWebhook(
    providerMethod: PaymentMethodEnum,
    payload: any,
    headers: Record<string, string>, // <--- NOUVEAU PARAMÈTRE : tous les headers
  ): Promise<any> {
    // NOTE: Cette logique sera enrichie quand nous aurons des fournisseurs concrets
    // Pour l'instant, c'est un placeholder.
    console.log(`Webhook received for ${providerMethod}`, payload);
    const provider = this.getProvider(providerMethod);
    const webhookResult = await provider.handleWebhook(payload, headers);
    // --- GESTION DU CONTEXTE ---
    if (webhookResult.metadata?.context === 'WALLET_DEPOSIT') {
      return this.processWalletDepositWebhook(webhookResult);
    } else {
      return this.prisma.$transaction(async (tx) => {
        const transaction = await tx.paymentTransaction.findUnique({
          where: { providerTransactionId: webhookResult.transactionId },
        });
        if (!transaction) {
          throw new NotFoundException(
            `Transaction de paiement ${webhookResult.transactionId} non trouvée.`,
          );
        }

        // Mettre à jour la transaction
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: webhookResult.status,
            metadata: webhookResult.metadata,
          },
        });

        // Mettre à jour le statut de la commande si le paiement est un succès
        if (webhookResult.status === 'SUCCESS') {
          return this.ordersService.updateOrderStatusLogic(
            tx,
            webhookResult.orderId,
            'PAID',
            transaction.id,
          );
        } else if (webhookResult.status === 'FAILED') {
          return this.ordersService.updateOrderStatusLogic(
            tx,
            webhookResult.orderId,
            'PAYMENT_FAILED',
          );
        } else if (webhookResult.status === 'REFUNDED') {
          return this.ordersService.updateOrderStatusLogic(
            tx,
            webhookResult.orderId,
            'REFUNDED',
          );
        }
        return {
          message: 'Webhook processed, but no order status change triggered.',
        };
      });
    }
  }

  // --- NOUVELLE MÉTHODE PRIVÉE POUR LE WEBHOOK DE DÉPÔT ---
  private async processWalletDepositWebhook(webhookResult: WebhookResult) {
    const walletTransactionId = webhookResult.metadata.walletTransactionId;
    if (!walletTransactionId) {
      throw new BadRequestException(
        'ID de transaction de portefeuille manquant dans les métadonnées du webhook.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.findUnique({
        where: { id: walletTransactionId },
      });

      if (!walletTx)
        throw new NotFoundException(
          `Transaction de portefeuille ${walletTransactionId} non trouvée.`,
        );
      if (walletTx.status === 'COMPLETED') {
        console.log(
          `Webhook pour la transaction de portefeuille ${walletTransactionId} déjà traitée. Ignoré.`,
        );
        return { message: 'Webhook déjà traité.' };
      }

      if (webhookResult.status === PaymentStatus.SUCCESS) {
        // Le dépôt a réussi : créditer le portefeuille
        await this.walletService.credit({
          walletId: walletTx.walletId,
          amount: walletTx.amount.toNumber(),
          description: `Dépôt réussi via ${webhookResult.provider}`,
          relatedPaymentTransactionId: webhookResult.transactionId,
          tx,
        });

        // Mettre à jour notre transaction de portefeuille
        await tx.walletTransaction.update({
          where: { id: walletTransactionId },
          data: { status: WalletTransactionStatus.COMPLETED },
        });

        // Mettre à jour la commande "fictive"
        await tx.order.update({
          where: { id: webhookResult.orderId },
          data: { status: OrderStatus.PAID },
        });
      } else if (webhookResult.status === PaymentStatus.FAILED) {
        // Le dépôt a échoué
        await tx.walletTransaction.update({
          where: { id: walletTransactionId },
          data: { status: WalletTransactionStatus.FAILED },
        });
        await tx.order.update({
          where: { id: webhookResult.orderId },
          data: { status: OrderStatus.PAYMENT_FAILED },
        });
      }

      return { message: 'Webhook de dépôt traité.' };
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
      if (
        // adminUser.profileType !== ProfileType.ADMIN &&
        order.business.ownerId !== adminUser.id
      ) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à rembourser cette commande.",
        );
      }
      if (order.status !== 'PAID') {
        throw new BadRequestException(
          'Seules les commandes payées peuvent être remboursées.',
        );
      }

      const lastPaymentTransaction = order.payments[0];
      if (!lastPaymentTransaction) {
        throw new BadRequestException(
          'Aucune transaction de paiement trouvée pour cette commande.',
        );
      }

      const provider = this.getProvider(lastPaymentTransaction.provider);
      const refundResult = await provider.refundPayment(
        order,
        adminUser,
        amount,
        tx as any,
      );

      // Mettre à jour le statut de la commande en fonction du remboursement
      const newOrderStatus =
        amount && amount < order.totalAmount.toNumber()
          ? 'PARTIALLY_REFUNDED'
          : 'REFUNDED';
      return this.ordersService.updateOrderStatusLogic(
        tx,
        order.id,
        newOrderStatus,
        refundResult.transactionId,
      );
    });
  }

  // --- NOUVELLE FONCTION POUR L'HISTORIQUE DES TRANSACTIONS CLIENT ---
  async findTransactionsForUser(userId: string, dto: QueryTransactionsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      method,
      status,
      orderId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentTransactionWhereInput = {
      order: {
        customerId: userId, // Filtrer par l'ID du client de la commande
      },
      provider: method,
      status,
      orderId,
    };

    if (search) {
      where.OR = [
        { providerTransactionId: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        // On pourrait chercher dans les métadonnées aussi si elles sont indexées
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined)
        where.amount.gte = new Prisma.Decimal(minAmount);
      if (maxAmount !== undefined)
        where.amount.lte = new Prisma.Decimal(maxAmount);
    }

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              type: true,
              business: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- NOUVELLE FONCTION POUR L'HISTORIQUE DES TRANSACTIONS D'UNE ENTREPRISE ---
  async findTransactionsForBusiness(
    businessId: string,
    userId: string,
    dto: QueryTransactionsDto,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business || business.ownerId !== userId) {
      // Vérification d'autorisation
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à consulter les transactions de cette entreprise.",
      );
    }

    const {
      page = 1,
      limit = 10,
      search,
      method,
      status,
      orderId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentTransactionWhereInput = {
      order: {
        businessId: businessId, // Filtrer par l'ID de l'entreprise recevant le paiement
      },
      provider: method,
      status,
      orderId,
    };

    if (search) {
      where.OR = [
        { providerTransactionId: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined)
        where.amount.gte = new Prisma.Decimal(minAmount);
      if (maxAmount !== undefined)
        where.amount.lte = new Prisma.Decimal(maxAmount);
    }

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              type: true,
              customer: { select: { id: true, firstName: true } },
            },
          },
        },
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
