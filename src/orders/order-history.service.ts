// src/orders/order-history.service.ts
import { Injectable } from '@nestjs/common';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrderHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre un nouvel événement dans l'historique d'une commande.
   * Doit être appelé à l'intérieur d'une transaction Prisma.
   * @param tx - Le client de transaction Prisma.
   * @param orderId - L'ID de la commande.
   * @param status - Le nouveau statut.
   * @param triggeredById - L'ID de l'utilisateur qui a déclenché l'événement (optionnel).
   * @param notes - Des notes additionnelles (optionnel).
   */
  async recordStatusChange(
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    orderId: string,
    status: OrderStatus,
    triggeredById?: string,
    notes?: string,
  ) {
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status,
        triggeredById,
        notes,
      },
    });
  }
}
