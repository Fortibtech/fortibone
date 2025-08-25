// src/orders/orders.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, User, OrderType } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService, // INJECTER
  ) {}

  async create(dto: CreateOrderDto, user: User) {
    // Validation de la logique métier
    if (dto.type === OrderType.PURCHASE && !dto.supplierBusinessId) {
      throw new BadRequestException(
        "Un ID de fournisseur (supplierBusinessId) est requis pour une commande d'achat.",
      );
    }

    // Démarrer une transaction pour garantir l'atomicité de la commande
    return this.prisma.$transaction(async (tx) => {
      // 1. Valider les lignes de commande et calculer le montant total
      let totalAmount = 0;
      const orderLinesData: Prisma.OrderLineCreateManyOrderInput[] = [];

      for (const line of dto.lines) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
        });
        if (!variant)
          throw new NotFoundException(
            `Variante avec l'ID ${line.variantId} non trouvée.`,
          );

        // Pour une vente, vérifier le stock
        if (
          dto.type === OrderType.SALE &&
          variant.quantityInStock < line.quantity
        ) {
          throw new BadRequestException(
            `Stock insuffisant pour la variante ${variant.sku || variant.id}. Demandé: ${line.quantity}, Disponible: ${variant.quantityInStock}.`,
          );
        }

        const price = variant.price; // Utiliser le prix actuel de la variante
        totalAmount += price * line.quantity;
        orderLinesData.push({
          variantId: line.variantId,
          quantity: line.quantity,
          price: price, // Enregistrer le prix au moment de la commande
        });
      }

      // 2. Créer l'entrée principale de la commande (Order)
      const orderData: Prisma.OrderCreateInput = {
        orderNumber: `ORD-${Date.now()}`, // Génération simple du numéro de commande
        type: dto.type,
        totalAmount,
        notes: dto.notes,
        business: { connect: { id: dto.businessId } },
        customer: { connect: { id: user.id } }, // Le client est toujours l'utilisateur qui passe l'action
        lines: { create: orderLinesData },
      };

      if (dto.type === OrderType.PURCHASE) {
        orderData.purchasingBusiness = { connect: { id: dto.businessId } };
        orderData.employee = { connect: { id: user.id } };
      }
      if (dto.type === OrderType.RESERVATION) {
        orderData.tableNumber = dto.tableNumber;
        orderData.reservationDate = dto.reservationDate
          ? new Date(dto.reservationDate)
          : undefined;
      }

      const order = await tx.order.create({ data: orderData });

      // 3. Mettre à jour l'inventaire si c'est une vente (SALE)
      if (dto.type === OrderType.SALE) {
        for (const line of dto.lines) {
          // Réutiliser notre logique FEFO robuste de l'InventoryService
          await this.inventoryService.decrementStockFromBatches(tx, {
            variantId: line.variantId,
            businessId: dto.businessId,
            userId: user.id,
            quantityToRemove: line.quantity,
            movementType: 'SALE',
            reason: `Vente - Commande #${order.orderNumber}`,
          });
        }
      }

      return this.findOne(order.id, tx); // Retourner la commande complète
    });
  }

  async findOne(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        lines: { include: { variant: { include: { product: true } } } },
        customer: { select: { id: true, firstName: true } },
        business: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée.');
    return order;
  }

  // TODO: Ajouter des méthodes pour lister les commandes d'un utilisateur, d'une entreprise, etc.
}
