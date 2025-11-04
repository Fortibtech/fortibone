// src/payments/payments.module.ts
import { Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersModule } from 'src/orders/orders.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MvolaProvider } from './providers/mvola.provider';
import { HttpModule, HttpService } from '@nestjs/axios'; // Assurez-vous que HttpModule est importé
import { StripeProvider } from './providers/stripe.provider';
import { PaymentMethodEnum } from '@prisma/client';
import { OrdersService } from 'src/orders/orders.service';
import { ManualPaymentProvider } from './providers/manual.provider';
import { WalletModule } from 'src/wallet/wallet.module';
import { KartaPayProvider } from './providers/kartapay.provider';
import { StripePayoutProvider } from './providers/stripe-payout.provider';
import { StripeConnectProvider } from './providers/stripe-connect.provider';
import {
  WithdrawalProvider,
  WithdrawalMethod,
} from './interfaces/withdrawal-provider.interface';
import { KartaPayDepositProvider } from './providers/kartapay-deposit.provider';
import { StripeDepositProvider } from './providers/stripe-deposit.provider';
import {
  DepositProvider,
  DepositMethod,
} from './interfaces/deposit-provider.interface';
import { KartaPayWithdrawalProvider } from './providers/kartapay-withdrawal.provider';

const paymentProviders: Provider[] = [
  StripeProvider,
  KartaPayProvider, // REMPLACER MVOLA
  MvolaProvider,
  ManualPaymentProvider,
];

const withdrawalProviders: Provider[] = [
  StripePayoutProvider,
  KartaPayWithdrawalProvider, // <--- Ici viendra le provider pour KartaPay
];

const depositProviders: Provider[] = [
  StripeDepositProvider,
  KartaPayDepositProvider,
];

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    HttpModule, // Ajouter HttpModule ici
    forwardRef(() => OrdersModule),
    forwardRef(() => WalletModule), // AJOUTER
  ],
  providers: [
    PaymentsService,
    StripeConnectProvider, // Le provider de base pour Stripe
    StripeProvider, // Le provider de base
    KartaPayProvider, // Le provider de base
    ...paymentProviders,
    ...(withdrawalProviders as any),
    ...depositProviders,

    {
      provide: 'PAYMENT_PROVIDERS_MAP',
      useFactory: (
        configService: ConfigService,
        httpService: HttpService,
        ...providers: PaymentProvider[]
      ) => {
        const providerMap = new Map<PaymentMethodEnum, PaymentProvider>();
        // Passer HttpService aux providers qui en ont besoin
        providers.forEach((p) => {
          if (p instanceof MvolaProvider) {
            // S'assurer que le MvolaProvider a accès à HttpService et ConfigService
            Object.assign(p, new MvolaProvider(configService, httpService));
          }
          providerMap.set(p.method, p);
        });
        return providerMap;
      },
      inject: [ConfigService, HttpService, OrdersService, ...paymentProviders],
    },

    // --- NOUVEAU PROVIDER DYNAMIQUE POUR LES RETRAITS ---
    {
      provide: 'WITHDRAWAL_PROVIDERS_MAP',
      useFactory: (...providers: WithdrawalProvider[]) => {
        const providerMap = new Map<WithdrawalMethod, WithdrawalProvider>();
        providers.forEach((p) => providerMap.set(p.method, p));
        return providerMap;
      },
      inject: withdrawalProviders,
    },

    // --- NOUVEAU PROVIDER DYNAMIQUE POUR LES DÉPÔTS ---
    {
      provide: 'DEPOSIT_PROVIDERS_MAP',
      useFactory: (...providers: DepositProvider[]) => {
        const providerMap = new Map<DepositMethod, DepositProvider>();
        providers.forEach((p) => providerMap.set(p.method, p));
        return providerMap;
      },
      inject: depositProviders,
    },
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentsService,
    'WITHDRAWAL_PROVIDERS_MAP',
    'DEPOSIT_PROVIDERS_MAP',
    StripeConnectProvider,
  ],
})
export class PaymentsModule {}
