// src/payments/interfaces/deposit-provider.interface.ts
import {
  PaymentMethodEnum,
  PrismaClient,
  User,
  Wallet,
  WalletTransaction,
} from '@prisma/client';
import { DepositDto } from 'src/wallet/dto/deposit.dto';
import { PaymentIntentResult } from './payment-provider.interface';

// L'enum des méthodes de dépôt, qui est un sous-ensemble des méthodes de paiement
export enum DepositMethod {
  STRIPE = 'STRIPE',
  KARTAPAY = 'KARTAPAY',
}

export abstract class DepositProvider {
  abstract readonly method: DepositMethod;

  abstract initiateDeposit(
    user: User,
    wallet: Wallet,
    walletTransaction: WalletTransaction,
    dto: DepositDto,
    tx: PrismaClient,
  ): Promise<PaymentIntentResult>;
}
