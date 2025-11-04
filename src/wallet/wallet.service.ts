// src/wallet/wallet.service.ts
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentMethodEnum,
  PaymentStatus,
  Prisma,
  PrismaClient,
  User,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { CurrenciesService } from 'src/currencies/currencies.service';
import { PaymentsService } from 'src/payments/payments.service';
import { DepositDto } from './dto/deposit.dto';
import { QueryWalletTransactionsDto } from './dto/query-wallet-transactions.dto';
import { ReviewWithdrawalDto } from './dto/review-withdrawal.dto';
import { WithdrawalDto, WithdrawalMethod } from './dto/withdrawal.dto';
import { WithdrawalProvider } from 'src/payments/interfaces/withdrawal-provider.interface';
import {
  DepositMethod,
  DepositProvider,
} from 'src/payments/interfaces/deposit-provider.interface';

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
  private withdrawalProviders: Map<WithdrawalMethod, WithdrawalProvider>;
  private depositProviders: Map<DepositMethod, DepositProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly currenciesService: CurrenciesService, // Pour la devise par défaut
    private readonly paymentsService: PaymentsService, // Pour initier les paiements externes
    @Inject('WITHDRAWAL_PROVIDERS_MAP')
    withdrawalProvidersMap: Map<WithdrawalMethod, WithdrawalProvider>,
    @Inject('DEPOSIT_PROVIDERS_MAP')
    depositProvidersMap: Map<DepositMethod, DepositProvider>,
  ) {
    this.withdrawalProviders = withdrawalProvidersMap;
    this.depositProviders = depositProvidersMap;
  }

  /**
   * Trouve le portefeuille d'un utilisateur. Si le portefeuille n'existe pas,
   * il est créé automatiquement avec la devise par défaut (EUR).
   * @param userId - L'ID de l'utilisateur.
   * @returns Le portefeuille de l'utilisateur.
   */
  async findOrCreateUserWallet(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { currency: true },
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
        include: { currency: true },
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
    return { wallet: finalWallet, transaction };
  }

  private getDepositProvider(method: DepositMethod): DepositProvider {
    const provider = this.depositProviders.get(method);
    if (!provider) {
      throw new BadRequestException(
        `La méthode de dépôt "${method}" n'est pas supportée.`,
      );
    }
    return provider;
  }
  // --- MÉTHODE initiateDeposit REFACTORISÉE ---
  async initiateDeposit(userId: string, dto: DepositDto) {
    const { amount, method } = dto;
    const wallet = await this.findOrCreateUserWallet(userId);
    const provider = this.getDepositProvider(
      method as unknown as DepositMethod,
    );
    return this.prisma.$transaction(async (tx) => {
      // 1. Créer la transaction de portefeuille en attente
      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount: new Prisma.Decimal(amount),
          status: 'PENDING',
          description: `Dépôt en attente via ${method}`,
        },
      });

      // 2. Déléguer l'initiation du paiement externe au provider spécifique
      const paymentResult = await provider.initiateDeposit(
        { id: userId } as User,
        wallet,
        walletTransaction,
        dto,
        tx as any,
      );

      // 3. Lier la transaction de paiement externe à notre transaction de portefeuille
      await tx.paymentTransaction.upsert({
        where: { providerTransactionId: paymentResult.transactionId },
        update: {
          walletTransaction: { connect: { id: walletTransaction.id } },
        },
        create: {
          // Créer une transaction de paiement si elle n'existe pas
          provider: method as unknown as PaymentMethodEnum,
          providerTransactionId: paymentResult.transactionId,
          status: paymentResult.status,
          amount: new Prisma.Decimal(amount),
          currencyCode: wallet.currency.code,
          orderId: null, // Pas lié à une commande
          walletTransaction: { connect: { id: walletTransaction.id } },
        },
      });

      // Si le paiement a réussi immédiatement (cas Stripe avec confirmation auto)
      if (paymentResult.status === 'SUCCESS') {
        await this.credit({
          walletId: wallet.id,
          amount: amount,
          description: `Dépôt réussi via ${method}`,
          relatedPaymentTransactionId: paymentResult.transactionId,
          tx,
        });
        await tx.walletTransaction.update({
          where: { id: walletTransaction.id },
          data: { status: 'COMPLETED' },
        });
      }

      return paymentResult;
    });
  }
  /**
   * Récupère l'historique des transactions du portefeuille d'un utilisateur,
   * avec des options de filtrage et de pagination.
   * @param userId - L'ID de l'utilisateur.
   * @param dto - Les paramètres de requête pour le filtrage et la pagination.
   * @returns Une liste paginée de transactions de portefeuille.
   */
  async findUserTransactions(userId: string, dto: QueryWalletTransactionsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status,
      startDate,
      endDate,
    } = dto;
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

  private getWithdrawalProvider(method: WithdrawalMethod): WithdrawalProvider {
    const provider = this.withdrawalProviders.get(method);
    if (!provider) {
      throw new BadRequestException(
        `La méthode de retrait "${method}" n'est pas supportée.`,
      );
    }
    return provider;
  }

  // --- MÉTHODE requestWithdrawal REFACTORISÉE ---
  async requestWithdrawal(userId: string, dto: WithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const wallet = await this.findOrCreateUserWallet(userId);
    const provider = this.getWithdrawalProvider(dto.method);

    // Démarrer une transaction Prisma pour l'opération
    return this.prisma.$transaction(async (tx) => {
      const result = await provider.requestWithdrawal(
        user as any,
        wallet,
        dto,
        tx as any,
      );

      // Si le statut est REQUIRES_SETUP, on doit lever une exception pour le contrôleur
      if (result.status === 'REQUIRES_SETUP') {
        throw new HttpException(
          {
            message: result.message,
            onboardingUrl: result.onboardingUrl,
          },
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }

      // Retourner la transaction de portefeuille créée
      if (result.withdrawalTransactionId) {
        return this.prisma.walletTransaction.findUnique({
          where: { id: result.withdrawalTransactionId },
        });
      } else {
        throw new InternalServerErrorException(
          'Erreur lors de la création de la transaction de retrait.',
        );
      }
    });
  }
}
