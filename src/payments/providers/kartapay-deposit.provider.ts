// src/payments/providers/kartapay-deposit.provider.ts
import { Injectable } from '@nestjs/common';
import {
  DepositProvider,
  DepositMethod,
} from '../interfaces/deposit-provider.interface';
import { PrismaClient, User, Wallet, WalletTransaction } from '@prisma/client';
import { DepositDto } from 'src/wallet/dto/deposit.dto';
import { PaymentIntentResult } from '../interfaces/payment-provider.interface';
import { KartaPayProvider } from './kartapay.provider'; // Réutiliser le provider de base
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class KartaPayDepositProvider implements DepositProvider {
  public readonly method = DepositMethod.KARTAPAY;

  constructor(private readonly kartaPayProvider: KartaPayProvider) {}

  async initiateDeposit(
    user: User,
    wallet: Wallet & { currency: { code: string } },
    walletTransaction: WalletTransaction,
    dto: DepositDto,
    tx: PrismaClient,
  ): Promise<PaymentIntentResult> {
    const { amount } = dto;

    const metadata = {
      context: 'WALLET_DEPOSIT',
      walletTransactionId: walletTransaction.id,
      userId: user.id,
    };

    return this.kartaPayProvider.createPaymentIntent(
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
