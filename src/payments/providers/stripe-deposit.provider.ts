// src/payments/providers/stripe-deposit.provider.ts
import { Injectable } from '@nestjs/common';
import {
  DepositProvider,
  DepositMethod,
} from '../interfaces/deposit-provider.interface';
import {
  PrismaClient,
  User,
  Wallet,
  WalletTransaction,
  PaymentStatus,
} from '@prisma/client';
import { DepositDto } from 'src/wallet/dto/deposit.dto';
import { PaymentIntentResult } from '../interfaces/payment-provider.interface';
import { StripeProvider } from './stripe.provider'; // Réutiliser le provider de base
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StripeDepositProvider implements DepositProvider {
  public readonly method = DepositMethod.STRIPE;

  constructor(private readonly stripeProvider: StripeProvider) {}

  async initiateDeposit(
    user: User,
    wallet: Wallet & { currency: { code: string } },
    walletTransaction: WalletTransaction,
    dto: DepositDto,
    tx: PrismaClient,
  ): Promise<PaymentIntentResult> {
    const { amount } = dto;

    const paymentMethodId = dto.metadata?.paymentMethodId as string | undefined;

    const metadata = {
      context: 'WALLET_DEPOSIT',
      walletTransactionId: walletTransaction.id,
      userId: user.id,
      paymentMethodId: paymentMethodId,
    };

    return this.stripeProvider.createPaymentIntent(
      {
        totalAmount: new Decimal(amount),
        business: { currency: { code: wallet.currency.code } },
      } as any,
      user,
      tx,
      metadata,
    );
  }
}
