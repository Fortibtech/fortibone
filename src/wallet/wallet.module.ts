// src/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CurrenciesModule } from 'src/currencies/currencies.module'; // Importer

@Module({
  imports: [PrismaModule, CurrenciesModule], // Ajouter CurrenciesModule
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService], // Exporter pour les autres modules
})
export class WalletModule {}
