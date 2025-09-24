// src/orders/orders.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, User, OrderType, OrderStatus } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

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

        const price = variant.price.toNumber(); // Utiliser le prix actuel de la variante
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
        // Logique spécifique aux ACHATS
        // L'entreprise qui reçoit la commande est le FOURNISSEUR
        orderData.business = { connect: { id: dto.supplierBusinessId } };
        // L'entreprise qui passe la commande est l'ACHETEUR
        orderData.purchasingBusiness = { connect: { id: dto.businessId } };
        orderData.employee = { connect: { id: user.id } }; // L'employé qui a passé la commande
      }
      if (dto.type === OrderType.RESERVATION) {
        orderData.table = dto.tableId
          ? { connect: { id: dto.tableId } }
          : undefined;
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
        business: true,
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée.');
    return order;
  }

  // --- Nouvelle méthode utilitaire pour les mises à jour de statut atomiques ---
  async updateOrderStatusLogic(
    tx: Prisma.TransactionClient,
    orderId: string,
    newStatus: OrderStatus,
    transactionId?: string, // L'ID de la transaction de paiement associée
  ) {
    const data: Prisma.OrderUpdateInput = { status: newStatus };
    if (transactionId) {
      data.transactionId = transactionId;
    }
    return tx.order.update({
      where: { id: orderId },
      data,
      include: { business: { include: { currency: true } } }, // Inclure pour la réponse
    });
  }

  // --- NOUVELLE MÉTHODE POUR LES MISES À JOUR PARTIELLES ---
  async updateOrder(orderId: string, userId: string, dto: UpdateOrderDto) {
    const order = await this.findOne(orderId); // Assurez-vous d'inclure business.ownerId dans findOne

    // Sécurité : Seul le propriétaire de l'entreprise peut modifier sa commande.
    if (order.business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier cette commande.",
      );
    }

    // Règles d'affaires : Ne peut pas modifier une commande déjà complétée ou annulée/rejetée
    const nonModifiableStatuses = [
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
      OrderStatus.DELIVERED,
    ];
    if (nonModifiableStatuses.includes(order.status as any)) {
      throw new BadRequestException(
        `La commande ne peut pas être modifiée avec le statut ${order.status}.`,
      );
    }

    // Si on modifie l'adresse de livraison, elle ne doit pas être déjà expédiée
    if (dto.shippingAddress && order.status === OrderStatus.SHIPPED) {
      throw new BadRequestException(
        "Impossible de modifier l'adresse de livraison d'une commande déjà expédiée.",
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: dto,
    });
  }

  // --- MISE À JOUR DE findForUser() AVEC FILTRES ---
  async findForUser(userId: string, dto: QueryOrdersDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      variantId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      customerId: userId,
      status,
      type,
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        {
          lines: {
            some: {
              variant: {
                product: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        },
      ];
    }
    if (variantId) {
      where.lines = { some: { variantId: variantId } };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined)
        where.totalAmount.gte = new Prisma.Decimal(minAmount);
      if (maxAmount !== undefined)
        where.totalAmount.lte = new Prisma.Decimal(maxAmount);
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  imageUrl: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
          business: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- MISE À JOUR DE findForBusiness() AVEC FILTRES ---
  async findForBusiness(
    businessId: string,
    userId: string,
    dto: QueryOrdersDto,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business || business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      customerId,
      variantId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      businessId,
      status,
      type,
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        {
          lines: {
            some: {
              variant: {
                product: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          },
        },
      ];
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (variantId) {
      where.lines = { some: { variantId: variantId } };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined)
        where.totalAmount.gte = new Prisma.Decimal(minAmount);
      if (maxAmount !== undefined)
        where.totalAmount.lte = new Prisma.Decimal(maxAmount);
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  imageUrl: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  // --- NOUVELLE FONCTION POUR METTRE À JOUR LE STATUT ---
  async updateStatus(
    orderId: string,
    userId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOne(orderId);

    // Sécurité : Seul le propriétaire de l'entreprise qui reçoit la commande peut changer son statut.
    const businessOwnerId = order.business.ownerId; // Assurez-vous d'inclure ownerId dans findOne
    if (businessOwnerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    // Logique de transition de statut (peut être enrichie)
    // Exemple : on ne peut pas passer de CANCELLED à SHIPPED
    const allowedTransitions = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
    };

    if (
      allowedTransitions[order.status] &&
      !allowedTransitions[order.status].includes(dto.status)
    ) {
      throw new BadRequestException(
        `Impossible de passer du statut ${order.status} à ${dto.status}.`,
      );
    }

    // Gérer le cas spécial de l'annulation
    if (
      dto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      return this.cancelOrder(order, userId);
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status },
    });
  }

  // --- NOUVELLE FONCTION POUR L'ANNULATION ---
  private async cancelOrder(order: any, userId: string) {
    // Une commande ne peut être annulée que si elle n'est pas déjà expédiée, livrée ou complétée.
    const cancellableStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Une commande avec le statut ${order.status} ne peut pas être annulée.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le statut de la commande
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      // 2. Si c'était une vente, réapprovisionner le stock
      if (order.type === OrderType.SALE) {
        for (const line of order.lines) {
          // Utiliser la logique d'incrémentation de l'InventoryService pour créer un nouveau lot pour le retour.
          await this.inventoryService.incrementStockAsNewBatch(tx, {
            variantId: line.variantId,
            businessId: order.businessId,
            userId,
            quantityToAdd: line.quantity,
            movementType: 'RETURN',
            reason: `Annulation - Commande #${order.orderNumber}`,
          });
        }
      }

      return {
        message:
          'La commande a été annulée avec succès et le stock a été réapprovisionné.',
      };
    });
  }
}
