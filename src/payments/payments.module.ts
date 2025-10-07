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

const paymentProviders: Provider[] = [
  StripeProvider,
  MvolaProvider,
  ManualPaymentProvider,
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
    ...(paymentProviders as any),
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
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
