// src/payments/providers/stripe-payout.provider.ts
import {
  Injectable,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient, User, Wallet } from '@prisma/client';
import {
  WithdrawalProvider,
  WithdrawalResult,
  WithdrawalMethod,
} from '../interfaces/withdrawal-provider.interface';
import { WithdrawalDto } from 'src/wallet/dto/withdrawal.dto';
import { StripeConnectProvider } from './stripe-connect.provider'; // Réutiliser la logique de base de Stripe Connect
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StripePayoutProvider implements WithdrawalProvider {
  public readonly method = WithdrawalMethod.STRIPE_PAYOUT;

  constructor(private readonly stripeConnectProvider: StripeConnectProvider) {}

  async requestWithdrawal(
    user: User,
    wallet: Wallet & { currency: { code: string } },
    dto: WithdrawalDto,
    tx: PrismaClient,
  ): Promise<WithdrawalResult> {
    const { amount } = dto;

    // 1. Trouver/créer le compte connecté Stripe
    const stripeAccount =
      await this.stripeConnectProvider.findOrCreateConnectedAccount(user);
    if (!user.stripeAccountId) {
      // Mettre à jour notre BDD avec l'ID du compte Stripe si c'est la première fois
      await tx.user.update({
        where: { id: user.id },
        data: { stripeAccountId: stripeAccount.id },
      });
    }

    // 2. Vérifier si l'onboarding est terminé
    if (!stripeAccount.details_submitted) {
      const returnUrl = 'https://votre-frontend.com/wallet/stripe-return';
      const refreshUrl = 'https://votre-backend.com/wallet/stripe-refresh';
      const accountLink = await this.stripeConnectProvider.createAccountLink(
        stripeAccount.id,
        returnUrl,
        refreshUrl,
      );

      return {
        status: 'REQUIRES_SETUP',
        message: 'Configuration du compte de paiement requise.',
        onboardingUrl: accountLink.url,
        withdrawalTransactionId: null, // Pas de transaction créée car rien n'est débité
      };
    }

    // 3. Le compte est configuré, on peut procéder au retrait
    if (wallet.balance.toNumber() < amount) {
      throw new BadRequestException('Solde du portefeuille insuffisant.');
    }

    // 4. Débiter le portefeuille (bloquer les fonds)
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: new Decimal(amount) } },
    });

    // 5. Créer la transaction de retrait avec le statut PENDING
    const withdrawalTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount: new Decimal(-amount),
        status: 'PENDING',
        description: `Demande de retrait vers le compte Stripe ${stripeAccount.id}`,
        // metadata: { provider: 'STRIPE_PAYOUT' },
      },
    });

    // 6. Initier le transfert vers le compte connecté Stripe
    await this.stripeConnectProvider.createTransfer(
      stripeAccount.id,
      amount,
      wallet.currency.code,
      { withdrawal_transaction_id: withdrawalTx.id },
    );

    return {
      status: 'PENDING',
      message:
        'Votre demande de retrait a été initiée et est en cours de traitement.',
      withdrawalTransactionId: withdrawalTx.id,
    };
  }
}
