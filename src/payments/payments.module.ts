// src/payments/payments.module.ts
import { Module, Provider, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './providers/stripe.provider';
import { OrdersModule } from 'src/orders/orders.module';

const paymentProviders: Provider[] = [
  StripeProvider,
  // ... MvolaProvider, ManualPaymentProvider viendront ici ...
];

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => OrdersModule), // Gérer la dépendance circulaire
  ],
  providers: [
    PaymentsService,
    ...paymentProviders, // Enregistrer tous les fournisseurs concrets

    // Provider dynamique qui injecte tous les PaymentProvider dans PaymentsService
    {
      provide: 'PAYMENT_PROVIDERS_MAP', // Utiliser un token personnalisé
      useFactory: (
        configService: ConfigService,
        ...providers: PaymentProvider[] // NestJS va collecter toutes les instances de PaymentProvider
      ) => {
        const providerMap = new Map<PaymentMethodEnum, PaymentProvider>();
        providers.forEach((p) => providerMap.set(p.method, p));
        return providerMap;
      },
      inject: [ConfigService, ...paymentProviders], // Injecter les fournisseurs concrets
    },
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}