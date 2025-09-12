// src/payments/providers/manual.provider.ts
import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentIntentResult,
  WebhookResult,
  RefundResult,
} from '../interfaces/payment-provider.interface';
import {
  Order,
  PaymentMethodEnum,
  PaymentStatus,
  PaymentTransaction,
  PrismaClient,
  User,
  ProfileType,
  Business,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  public readonly method: PaymentMethodEnum = PaymentMethodEnum.MANUAL;

  constructor(private readonly configService: ConfigService) {}

  // Pour les paiements manuels, il n'y a pas d'intention de paiement externe à créer.
  // Cette méthode est appelée quand une commande est placée avec un paiement manuel.
  // Elle ne retourne qu'un statut PENDING car la confirmation est manuelle.
  async createPaymentIntent(
    order: Order,
    user: User,
    tx: PrismaClient,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    // Pour un paiement manuel, l'intention est que le paiement sera confirmé plus tard.
    // On retourne un transactionId unique généré en interne.
    const transactionId = `MANUAL-${order.id}-${Date.now()}`;
    return {
      transactionId,
      status: PaymentStatus.PENDING, // Toujours en attente de confirmation
    };
  }

  // La gestion des webhooks n'est pas applicable aux paiements manuels.
  async handleWebhook(
    payload: any,
    headers?: Record<string, any>,
  ): Promise<WebhookResult> {
    throw new BadRequestException(
      'Les webhooks ne sont pas applicables au fournisseur de paiement manuel.',
    );
  }

  // --- Confirmation d'un paiement manuel (méthode clé) ---
  async confirmManualPayment(
    order: Order,
    user: User, // L'utilisateur (employé/admin) qui confirme le paiement
    tx: PrismaClient,
    details?: any, // Détails supplémentaires de la confirmation (référence de virement, etc.)
  ): Promise<PaymentTransaction> {
    // 1. Vérifier que la commande existe et est bien en attente de paiement manuel
    if (!order) {
      throw new NotFoundException('Commande non trouvée.');
    }
    if (
      order.status !== 'PENDING_PAYMENT' ||
      order.paymentMethod !== PaymentMethodEnum.MANUAL
    ) {
      throw new BadRequestException(
        "La commande n'est pas en attente de confirmation de paiement manuel.",
      );
    }

    // 2. Vérifier l'autorisation : seul le propriétaire de l'entreprise ou un ADMIN peut confirmer
    const business = await tx.business.findUnique({
      where: { id: order.businessId },
      select: { ownerId: true },
    });
    if (!business)
      throw new InternalServerErrorException(
        'Entreprise de la commande non trouvée.',
      );

    const isOwner = business.ownerId === user.id;
    const isAdminOfBusiness = await tx.businessMember.findUnique({
      where: {
        userId_businessId: { userId: user.id, businessId: order.businessId },
        role: 'ADMIN',
      },
    });
    // const isPlatformAdmin = user.profileType === ProfileType.ADMIN;

    if (!isOwner && !isAdminOfBusiness /*&& !isPlatformAdmin */) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à confirmer ce paiement manuel.",
      );
    }

    // 3. Mettre à jour la transaction de paiement existante
    // Normalement, une transaction PENDING est créée lors de createPaymentIntent
    const existingTransaction = await tx.paymentTransaction.findFirst({
      where: {
        orderId: order.id,
        provider: PaymentMethodEnum.MANUAL,
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingTransaction) {
      throw new InternalServerErrorException(
        'Aucune transaction manuelle en attente trouvée pour cette commande.',
      );
    }

    return tx.paymentTransaction.update({
      where: { id: existingTransaction.id },
      data: {
        status: PaymentStatus.SUCCESS,
        metadata: {
          confirmedBy: user.id,
          confirmedAt: new Date().toISOString(),
          ...details,
        },
        providerTransactionId:
          existingTransaction.providerTransactionId ||
          `MANUAL_CONF-${order.id}-${Date.now()}`, // S'assurer qu'il y a un ID de transaction
      },
    });
  }

  // --- Remboursement d'un paiement manuel ---
  async refundPayment(
    order: any,
    user: User, // L'utilisateur qui demande/effectue le remboursement (ex: admin)
    amount?: number, // Montant à rembourser (partiel)
    tx?: PrismaClient,
  ): Promise<RefundResult> {
    // La logique de remboursement manuel consiste à enregistrer le remboursement.
    // Aucune API externe n'est appelée.
    const db = tx || new PrismaClient(); // Utiliser la transaction si fournie

    const business = await db.business.findUnique({
      where: { id: order.businessId },
      select: { ownerId: true },
    });
    if (!business)
      throw new InternalServerErrorException(
        'Entreprise de la commande non trouvée.',
      );

    const isOwner = business.ownerId === user.id;
    const isAdminOfBusiness = await db.businessMember.findUnique({
      where: {
        userId_businessId: { userId: user.id, businessId: order.businessId },
        role: 'ADMIN',
      },
    });
    // const isPlatformAdmin = user.profileType === ProfileType.ADMIN;

    if (!isOwner && !isAdminOfBusiness /* && !isPlatformAdmin */) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à initier ce remboursement manuel.",
      );
    }

    if (order.status !== 'PAID' && order.status !== 'PARTIALLY_REFUNDED') {
      throw new BadRequestException(
        'Seules les commandes payées ou partiellement remboursées peuvent être remboursées manuellement.',
      );
    }

    // Enregistrer la transaction de remboursement
    const refundTransaction = await db.paymentTransaction.create({
      data: {
        orderId: order.id,
        amount: amount ? new Prisma.Decimal(amount) : order.totalAmount,
        currencyCode: order.business.currency.code,
        provider: PaymentMethodEnum.MANUAL,
        providerTransactionId: `MANUAL_REFUND-${order.id}-${Date.now()}`,
        status: PaymentStatus.REFUNDED,
        metadata: {
          refundedBy: user.id,
          refundedAt: new Date().toISOString(),
          originalPaymentIntentId: order.paymentIntentId,
        },
      },
    });

    return {
      transactionId: refundTransaction.id,
      status: PaymentStatus.REFUNDED,
      amountRefunded: amount || order.totalAmount.toNumber(),
    };
  }
}
