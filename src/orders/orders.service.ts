// src/orders/orders.service.ts
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  Prisma,
  User,
  OrderType,
  OrderStatus,
  PaymentMethodEnum,
  WalletTransaction,
  Order,
} from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { WalletService } from 'src/wallet/wallet.service';
import { ShipOrderDto } from './dto/ship-order.dto';
import { UpdateOrderLineStatusDto } from './dto/update-order-line-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService, // INJECTER
    @Inject(forwardRef(() => WalletService)) // Gérer la dépendance circulaire
    private readonly walletService: WalletService,
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
      let subTotal = 0;
      // let totalAmount = 0;
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
        subTotal += price * line.quantity;
        // totalAmount += price * line.quantity;
        orderLinesData.push({
          variantId: line.variantId,
          quantity: line.quantity,
          price: price, // Enregistrer le prix au moment de la commande
        });
      }

      const shippingFee = new Prisma.Decimal(dto.shippingFee || 0);
      const discountAmount = new Prisma.Decimal(dto.discountAmount || 0);
      const totalAmount = new Prisma.Decimal(subTotal)
        .minus(discountAmount)
        .plus(shippingFee);

      if (totalAmount.isNegative()) {
        throw new BadRequestException(
          'Le montant total de la commande ne peut pas être négatif.',
        );
      }

      // --- NOUVELLE LOGIQUE POUR LE PAIEMENT PAR PORTEFEUILLE ---
      let orderStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;
      let paymentMethod: PaymentMethodEnum | null = null;
      let transactionId: string | null | undefined = null;
      let paymentTransaction: WalletTransaction | null = null;

      if (dto.useWallet && dto.type === OrderType.SALE) {
        const wallet = await this.walletService.findOrCreateUserWallet(user.id);
        if (wallet.balance.toNumber() < totalAmount.toNumber()) {
          throw new BadRequestException(
            'Solde du portefeuille insuffisant pour effectuer cet achat.',
          );
        }

        // Débiter le portefeuille
        const { transaction } = await this.walletService.debit({
          walletId: wallet.id,
          amount: totalAmount.toNumber(),
          description: `Paiement pour la commande #${`ORD-${Date.now()}`}`, // Utiliser un placeholder
          tx,
        });
        paymentTransaction = transaction;

        orderStatus = OrderStatus.PAID; // La commande est payée immédiatement
        paymentMethod = PaymentMethodEnum.WALLET; // Le moyen de paiement est le portefeuille
        transactionId = paymentTransaction?.id; // Enregistrer l'ID de la transaction de paiement
      }

      // 2. Créer l'entrée principale de la commande (Order)
      const orderData: Prisma.OrderCreateInput = {
        orderNumber: `ORD-${Date.now()}`,
        type: dto.type,
        status: orderStatus, // Utiliser le statut déterminé
        subTotal,
        shippingFee,
        discountAmount,
        totalAmount,
        notes: dto.notes,
        business: { connect: { id: dto.businessId } },
        customer: { connect: { id: user.id } },
        lines: { create: orderLinesData },
        paymentMethod: paymentMethod, // Enregistrer la méthode de paiement
        transactionId: transactionId,
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

      // Mettre à jour la transaction de portefeuille avec le véritable Order ID
      if (paymentTransaction) {
        await tx.walletTransaction.update({
          where: { id: paymentTransaction.id },
          data: {
            description: `Paiement pour la commande #${order.orderNumber}`,
            relatedOrderId: order.id,
          },
        });
      }

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

    // On s'assure que cette méthode ne peut pas être utilisée pour passer à SHIPPED
    if (dto.status === OrderStatus.SHIPPED) {
      throw new BadRequestException(
        "Utilisez l'endpoint dédié /ship pour expédier une commande.",
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
  private async cancelOrder(order: Order, userId: string) {
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

  // --- NOUVELLE MÉTHODE DÉDIÉE À L'EXPÉDITION ---
  async shipOrder(orderId: string, userId: string, dto: ShipOrderDto) {
    const order = await this.findOne(orderId, { id: userId } as any); // Utiliser le user simplifié

    if (order.business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    const allowedStatuses = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Une commande avec le statut ${order.status} ne peut pas être expédiée.`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
        shippingMode: dto.shippingMode, // Assurez-vous d'ajouter ce champ au DTO si nécessaire
        shippingCarrier: dto.shippingCarrier,
        shippingTrackingNumber: dto.shippingTrackingNumber,
        shippingDate: new Date(dto.shippingDate),
        estimatedDeliveryDate: dto.estimatedDeliveryDate
          ? new Date(dto.estimatedDeliveryDate)
          : undefined,
      },
    });
  }

  async updateLineStatus(
    orderId: string,
    lineId: string,
    userId: string,
    dto: UpdateOrderLineStatusDto,
  ) {
    const order = await this.findOne(orderId, { id: userId } as any);
    if (order.business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    const line = await this.prisma.orderLine.findUnique({
      where: { id: lineId },
    });
    if (!line || line.orderId !== orderId) {
      throw new NotFoundException(
        'Ligne de commande non trouvée pour cette commande.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Mettre à jour la ligne
      const updatedLine = await tx.orderLine.update({
        where: { id: lineId },
        data: { status: dto.status },
      });

      // Logique métier pour mettre à jour la commande principale
      if (dto.status === 'PREPARING' && order.status === 'CONFIRMED') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PROCESSING' },
        });
      }

      return updatedLine;
    });
  }
}
