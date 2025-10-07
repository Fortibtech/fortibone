// src/wallet/wallet.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CurrenciesModule } from 'src/currencies/currencies.module'; // Importer
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
  imports: [PrismaModule, CurrenciesModule, forwardRef(() => PaymentsModule)], // Ajouter CurrenciesModule
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService], // Exporter pour les autres modules
})
export class WalletModule {}
