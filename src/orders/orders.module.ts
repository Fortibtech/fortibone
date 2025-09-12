// src/orders/orders.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module'; // IMPORTER
import { PaymentsModule } from 'src/payments/payments.module';

@Module({
  imports: [
    PrismaModule,
    InventoryModule,
    forwardRef(() => PaymentsModule), // Gérer la dépendance circulaire
  ], // AJOUTER InventoryModule
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
