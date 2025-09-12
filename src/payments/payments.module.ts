// src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentProvider } from './interfaces/payment-provider.interface'; // Importer l'interface
import { PaymentsController } from './payments.controller';

// On ne met pas encore les fournisseurs concrets ici. Ils viendront dans la phase 2.
// Le module sera d'abord vide de providers concrets de paiement.
// Cela sera ajusté dans la Phase 2.

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    PaymentsService,
    // Ici viendra la logique 'useFactory' pour injecter dynamiquement le bon provider
    // Une fois que les providers concrets (StripeProvider, MvolaProvider, etc.) seront créés.
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService], // Exporter pour que OrdersModule puisse l'utiliser
})
export class PaymentsModule {}