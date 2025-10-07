// src/wallet/wallet.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  PrismaClient,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { CurrenciesService } from 'src/currencies/currencies.service';
import { PaymentsService } from 'src/payments/payments.service';
import { DepositDto } from './dto/deposit.dto';
import { QueryWalletTransactionsDto } from './dto/query-wallet-transactions.dto';

// Interface pour les paramètres des méthodes de crédit/débit, pour plus de clarté
interface WalletMovementParams {
  walletId: string;
  amount: number;
  description: string;
  relatedOrderId?: string;
  relatedPaymentTransactionId?: string;
  tx: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >; // Type pour le client de transaction Prisma
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currenciesService: CurrenciesService, // Pour la devise par défaut
    private readonly paymentsService: PaymentsService, // Pour initier les paiements externes
  ) {}

  /**
   * Trouve le portefeuille d'un utilisateur. Si le portefeuille n'existe pas,
   * il est créé automatiquement avec la devise par défaut (EUR).
   * @param userId - L'ID de l'utilisateur.
   * @returns Le portefeuille de l'utilisateur.
   */
  async findOrCreateUserWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Création automatique si le portefeuille n'existe pas
      const defaultCurrency = await this.currenciesService.findByCode('EUR');
      if (!defaultCurrency) {
        throw new InternalServerErrorException(
          "La devise par défaut (EUR) n'a pas pu être trouvée pour créer le portefeuille.",
        );
      }
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currencyId: defaultCurrency.id,
        },
      });
    }

    return wallet;
  }

  /**
   * Crédite le portefeuille d'un utilisateur de manière atomique.
   * Crée une transaction et incrémente le solde.
   * @param params - Les paramètres de l'opération de crédit.
   * @returns Le portefeuille mis à jour.
   */
  async credit(params: WalletMovementParams) {
    const {
      walletId,
      amount,
      description,
      relatedOrderId,
      relatedPaymentTransactionId,
      tx,
    } = params;

    if (amount <= 0) {
      throw new BadRequestException('Le montant à créditer doit être positif.');
    }

    // 1. Créer la transaction de portefeuille
    await tx.walletTransaction.create({
      data: {
        walletId,
        type: WalletTransactionType.DEPOSIT, // Ou REFUND, à adapter selon le contexte
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.COMPLETED,
        description,
        relatedOrderId,
        relatedPaymentTransactionId,
      },
    });

    // 2. Mettre à jour le solde du portefeuille
    return tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: {
          increment: new Prisma.Decimal(amount),
        },
      },
    });
  }

  /**
   * Débite le portefeuille d'un utilisateur de manière atomique.
   * Vérifie le solde, crée une transaction et décrémente le solde.
   * @param params - Les paramètres de l'opération de débit.
   * @returns Le portefeuille mis à jour.
   */
  async debit(params: WalletMovementParams) {
    const {
      walletId,
      amount,
      description,
      relatedOrderId,
      relatedPaymentTransactionId,
      tx,
    } = params;

    if (amount <= 0) {
      throw new BadRequestException('Le montant à débiter doit être positif.');
    }

    // 1. Vérification de solde (verrouillage au niveau de la ligne en transaction)
    const wallet = await tx.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.balance.toNumber() < amount) {
      throw new BadRequestException('Solde du portefeuille insuffisant.');
    }

    // 2. Créer la transaction de portefeuille
   const transaction = await tx.walletTransaction.create({
      data: {
        walletId,
        type: WalletTransactionType.PAYMENT, // Ou WITHDRAWAL, à adapter
        amount: new Prisma.Decimal(-amount), // Montant négatif pour un débit
        status: WalletTransactionStatus.COMPLETED,
        description,
        relatedOrderId,
        relatedPaymentTransactionId,
      },
    });

    // 3. Mettre à jour le solde du portefeuille
    const finalWallet = tx.wallet.update({
      where: { id: walletId },
      data: {
        balance: {
          decrement: new Prisma.Decimal(amount),
        },
      },
    });
    return {wallet: finalWallet, transaction };
  }

  // --- NOUVELLE MÉTHODE POUR INITIER UN DÉPÔT ---
  async initiateDeposit(userId: string, dto: DepositDto) {
    const { amount, method } = dto;
    const wallet = await this.findOrCreateUserWallet(userId);

    // 1. Démarrer une transaction Prisma pour créer la transaction de portefeuille en attente
    const walletTransaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEPOSIT,
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.PENDING,
        description: `Dépôt en attente via ${method}`,
      },
    });

    // 2. Créer une commande "fictive" pour le paiement, car notre PaymentsModule est basé sur les commandes
    // C'est une approche robuste pour réutiliser la logique de paiement existante.
    // On lie le paiement à l'entreprise FortiBone elle-même (à créer dans le seed si besoin).
    const fortiboneBusiness = await this.prisma.business.findFirst({
      // Trouver une entreprise "interne" qui représente la plateforme
      where: { name: 'FortiBone Platform' }, // Assurez-vous que cette entreprise existe
    });
    if (!fortiboneBusiness) {
      throw new InternalServerErrorException(
        'Entreprise de la plateforme non configurée pour les dépôts.',
      );
    }

    const depositOrder = await this.prisma.order.create({
      data: {
        orderNumber: `DEPOSIT-${walletTransaction.id}`,
        type: 'SALE', // Un dépôt est une "vente" de crédit de portefeuille
        status: 'PENDING_PAYMENT',
        totalAmount: new Prisma.Decimal(amount),
        businessId: fortiboneBusiness.id,
        customerId: userId,
      },
    });

    // 3. Appeler le PaymentsService pour créer l'intention de paiement externe
    try {
      const paymentIntentResult = await this.paymentsService.createPayment(
        depositOrder.id,
        { id: userId } as any, // Passer l'objet User simplifié
        method,
        {
          context: 'WALLET_DEPOSIT', // Le contexte CRUCIAL pour le webhook
          walletTransactionId: walletTransaction.id,
        },
      );

      // Lier la transaction de paiement externe à notre transaction de portefeuille
      await this.prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: {
          relatedPaymentTransactionId: paymentIntentResult.transactionId,
        },
      });

      return paymentIntentResult;
    } catch (error) {
      // Si l'initiation du paiement externe échoue, annuler la transaction de portefeuille
      await this.prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: { status: WalletTransactionStatus.FAILED },
      });
      throw error; // Propager l'erreur
    }
  }


   /**
   * Récupère l'historique des transactions du portefeuille d'un utilisateur,
   * avec des options de filtrage et de pagination.
   * @param userId - L'ID de l'utilisateur.
   * @param dto - Les paramètres de requête pour le filtrage et la pagination.
   * @returns Une liste paginée de transactions de portefeuille.
   */
  async findUserTransactions(userId: string, dto: QueryWalletTransactionsDto) {
    const { page = 1, limit = 10, search, type, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    // S'assurer que le portefeuille de l'utilisateur existe
    const wallet = await this.findOrCreateUserWallet(userId);

    // Construction dynamique de la clause WHERE
    const where: Prisma.WalletTransactionWhereInput = {
      walletId: wallet.id,
      type,
      status,
    };

    if (search) {
      where.description = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Exécuter les requêtes de comptage et de récupération en parallèle
    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        // Inclure les relations pertinentes pour l'affichage
        include: {
          relatedOrder: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      }),
      this.prisma.walletTransaction.count({ where }),
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
