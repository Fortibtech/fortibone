// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module'; // IMPORTER

@Module({
  imports: [PrismaModule, InventoryModule], // AJOUTER InventoryModule
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
