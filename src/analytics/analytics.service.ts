// src/analytics/analytics.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessType,
  MovementType,
  OrderStatus,
  OrderType,
  Prisma,
} from '@prisma/client';
import { QueryOverviewDto } from './dto/query-overview.dto'; // Importer le nouveau DTO
import { QuerySalesDto, SalesPeriodUnit } from './dto/query-sales.dto';
import {
  InventoryDetailsDto,
  LowStockProductItem,
  ExpiringProductItem,
  TotalLossesItem,
} from './dto/inventory-details.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import {
  CustomerDetailsDto,
  TopCustomerItem,
} from './dto/customer-details.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { QueryRestaurantDto } from './dto/query-restaurant.dto';
import {
  RestaurantDetailsDto,
  PopularDishItem,
  ReservationsByPeriodItem,
} from './dto/src/analytics/dto/restaurant-details.dto';
import { QueryMemberOverviewDto } from './dto/query-member-overview.dto';
import { MemberOverviewDto } from './dto/member-overview.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Vérification de propriété de l'entreprise
  private async verifyBusinessOwnership(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, name: true, type: true },
    });

    if (!business) {
      throw new NotFoundException('Entreprise non trouvée.');
    }
    // TODO: Dans un futur AdminModule, on pourrait vérifier si l'utilisateur est un ADMIN de la plateforme
    // ou un ADMIN de l'entreprise (via BusinessMember). Pour l'instant, seul le propriétaire.
    if (business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à consulter les statistiques de cette entreprise.",
      );
    }
    return business;
  }

  async getBusinessOverview(
    businessId: string,
    userId: string,
    queryDto: QueryOverviewDto,
  ) {
    await this.verifyBusinessOwnership(businessId, userId);

    const { startDate, endDate } = queryDto;

    // Construire la clause de date pour les requêtes Prisma
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Construire la clause de date pour les requêtes RAW (PostgreSQL attend des timestamps)
    const rawDateFilter: string[] = [];
    if (startDate)
      rawDateFilter.push(
        `"createdAt" >= '${new Date(startDate).toISOString()}'`,
      );
    if (endDate)
      rawDateFilter.push(`"createdAt" <= '${new Date(endDate).toISOString()}'`);
    const rawDateWhereClause =
      rawDateFilter.length > 0 ? `AND ${rawDateFilter.join(' AND ')}` : '';

    // Toutes les requêtes d'agrégation en parallèle pour la performance
    const [
      salesAggregates,
      purchaseAggregates,
      productsSoldAggregates,
      // inventoryAggregates, // Ceci est une valeur ponctuelle, pas dépendante d'une période
      membersCount,
      // uniqueCustomersCount, // Requiert RAW pour le distinct
      businessDetails,
    ] = await this.prisma.$transaction([
      // Ventes : totalAmount des commandes SALE complétées sur la période
      this.prisma.order.aggregate({
        where: {
          businessId: businessId,
          type: OrderType.SALE,
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          createdAt: dateFilter, // Appliquer le filtre de date
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // Achats : totalAmount des commandes PURCHASE complétées sur la période
      this.prisma.order.aggregate({
        where: {
          purchasingBusinessId: businessId, // L'entreprise ACHÈTE
          type: OrderType.PURCHASE,
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          createdAt: dateFilter, // Appliquer le filtre de date
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // Produits vendus : somme des quantités des OrderLine pour les ventes complétées sur la période
      this.prisma.orderLine.aggregate({
        where: {
          order: {
            businessId: businessId,
            type: OrderType.SALE,
            status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
            createdAt: dateFilter, // Appliquer le filtre de date
          },
        },
        _sum: { quantity: true },
      }),

      // Nombre de membres (ne dépend pas de la période, sauf si on veut les membres actifs sur une période)
      this.prisma.businessMember.count({
        where: { businessId: businessId },
      }),

      // Détails de l'entreprise (pour la note moyenne)
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { averageRating: true, reviewCount: true },
      }),
    ]);

    // --- Requêtes RAW pour les calculs qui nécessitent SQL natif ---
    // Valeur de l'inventaire actuel (valeur ponctuelle, ne dépend pas de la période)
    const inventoryValueResult = await this.prisma.$queryRaw<{ sum: number }[]>`
      SELECT COALESCE(SUM(pv.quantity_in_stock * pv.purchase_price), 0) as sum
      FROM "ProductVariant" pv
      JOIN "Product" p ON pv."product_id" = p.id
      WHERE p."businessId" = ${businessId}
    `;
    const currentInventoryValue = inventoryValueResult[0]?.sum || 0;

    // Nombre de clients uniques sur la période
    const uniqueCustomersResult = await this.prisma.$queryRaw<
      { count: bigint }[]
    >`
      SELECT COUNT(DISTINCT "customerId") as count
      FROM "Order"
      WHERE "businessId" = ${businessId}
      AND type = ${OrderType.SALE}::"OrderType"
      AND status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
      ${Prisma.sql`${rawDateWhereClause}`}
    `;
    const uniqueCustomers = uniqueCustomersResult[0]?.count
      ? Number(uniqueCustomersResult[0].count)
      : 0;

    const totalSalesAmount = salesAggregates._sum?.totalAmount?.toNumber() || 0;
    const totalSalesOrders = salesAggregates._count?.id || 0;
    const averageOrderValue =
      totalSalesOrders > 0
        ? parseFloat((totalSalesAmount / totalSalesOrders).toFixed(2))
        : 0;
    const totalProductsSold = productsSoldAggregates._sum?.quantity || 0;
    const totalPurchaseAmount =
      purchaseAggregates._sum?.totalAmount?.toNumber() || 0;
    const totalPurchaseOrders = purchaseAggregates._count?.id || 0;
    const totalMembers = membersCount;
    const averageBusinessRating = businessDetails?.averageRating || 0;
    const totalBusinessReviews = businessDetails?.reviewCount || 0;

    return {
      totalSalesAmount,
      totalSalesOrders,
      averageOrderValue,
      totalProductsSold,
      totalPurchaseAmount,
      totalPurchaseOrders,
      currentInventoryValue,
      totalMembers,
      uniqueCustomers,
      averageBusinessRating,
      totalBusinessReviews,
    };
  }

  // --- NOUVELLE MÉTHODE POUR LES STATISTIQUES DE VENTES DÉTAILLÉES ---
  async getSalesDetails(
    businessId: string,
    userId: string,
    queryDto: QuerySalesDto,
  ) {
    await this.verifyBusinessOwnership(businessId, userId);

    const { startDate, endDate, unit = SalesPeriodUnit.MONTH } = queryDto;

    // Clause de date pour les requêtes
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // const commonOrderWhereClause: Prisma.OrderWhereInput = {
    //   businessId: businessId,
    //   type: OrderType.SALE,
    //   status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
    //   createdAt: dateFilter,
    // };

    // Requêtes exécutées en parallèle pour la performance
    const [salesByPeriodRaw, topSellingProductsRaw, salesByProductCategoryRaw] =
      await this.prisma.$transaction([
        // 1. Ventes par période (requête RAW pour la flexibilité de GROUP BY)
        this.prisma.$queryRaw<
          { period: string; totalAmount: Prisma.Decimal; totalItems: bigint }[]
        >`
        SELECT
          ${this.getPeriodFormat(unit)} as period,
          COALESCE(SUM(o.total_amount), 0) as "totalAmount",
          COALESCE(SUM(ol.quantity), 0) as "totalItems"
        FROM "Order" o
        JOIN "OrderLine" ol ON o.id = ol."orderId"
        WHERE o."businessId" = ${businessId}
          AND o.type = ${OrderType.SALE}::"OrderType"
          AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
          ${startDate ? Prisma.sql`AND o."created_at" >= ${new Date(startDate)}` : Prisma.empty}
          ${endDate ? Prisma.sql`AND o."created_at" <= ${new Date(endDate)}` : Prisma.empty}
        GROUP BY period
        ORDER BY period ASC
      `,

        // 2. Top des produits les plus vendus (requête RAW pour la somme des quantités et revenus)
        this.prisma.$queryRaw<
          {
            variantId: string;
            sku: string;
            productName: string;
            variantImageUrl: string;
            totalQuantitySold: bigint;
            totalRevenue: Prisma.Decimal;
          }[]
        >`
        SELECT
          pv.id as "variantId",
          pv.sku,
          p.name as "productName",
          pv."imageUrl" as "variantImageUrl",
          COALESCE(SUM(ol.quantity), 0) as "totalQuantitySold",
          COALESCE(SUM(ol.quantity * ol.price), 0) as "totalRevenue"
        FROM "OrderLine" ol
        JOIN "Order" o ON ol."orderId" = o.id
        JOIN "ProductVariant" pv ON ol."variantId" = pv.id
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE o."businessId" = ${businessId}
          AND o.type = ${OrderType.SALE}::"OrderType"
          AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
          ${startDate ? Prisma.sql`AND o."created_at" >= ${new Date(startDate)}` : Prisma.empty}
          ${endDate ? Prisma.sql`AND o."created_at" <= ${new Date(endDate)}` : Prisma.empty}
        GROUP BY pv.id, pv.sku, p.name, pv."imageUrl"
        ORDER BY "totalQuantitySold" DESC
        LIMIT 10
      `,

        // 3. Ventes par catégorie de produit (requête RAW pour la somme des revenus par catégorie)
        this.prisma.$queryRaw<
          {
            categoryId: string;
            categoryName: string;
            totalRevenue: Prisma.Decimal;
            totalItemsSold: bigint;
          }[]
        >`
        SELECT
          c.id as "categoryId",
          c.name as "categoryName",
          COALESCE(SUM(ol.quantity * ol.price), 0) as "totalRevenue",
          COALESCE(SUM(ol.quantity), 0) as "totalItemsSold"
        FROM "OrderLine" ol
        JOIN "Order" o ON ol."orderId" = o.id
        JOIN "ProductVariant" pv ON ol."variantId" = pv.id
        JOIN "Product" p ON pv."product_id" = p.id
        JOIN "Category" c ON p."category_id" = c.id
        WHERE o."businessId" = ${businessId}
          AND o.type = ${OrderType.SALE}::"OrderType"
          AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
          ${startDate ? Prisma.sql`AND o."created_at" >= ${new Date(startDate)}` : Prisma.empty}
          ${endDate ? Prisma.sql`AND o."created_at" <= ${new Date(endDate)}` : Prisma.empty}
        GROUP BY c.id, c.name
        ORDER BY "totalRevenue" DESC
      `,
      ]);

    return {
      salesByPeriod: salesByPeriodRaw.map((item) => ({
        ...item,
        totalAmount: item.totalAmount.toNumber(),
        totalItems: Number(item.totalItems), // Convert BigInt to Number
      })),
      topSellingProducts: topSellingProductsRaw.map((item) => ({
        ...item,
        totalQuantitySold: Number(item.totalQuantitySold),
        totalRevenue: item.totalRevenue.toNumber(),
      })),
      salesByProductCategory: salesByProductCategoryRaw.map((item) => ({
        ...item,
        totalRevenue: item.totalRevenue.toNumber(),
        totalItemsSold: Number(item.totalItemsSold),
      })),
    };
  }

  // Helper pour formater la période dans les requêtes RAW
  private getPeriodFormat(unit: SalesPeriodUnit): Prisma.Sql {
    switch (unit) {
      case SalesPeriodUnit.DAY:
        return Prisma.sql`TO_CHAR(o."created_at", 'YYYY-MM-DD')`;
      case SalesPeriodUnit.WEEK:
        return Prisma.sql`TO_CHAR(o."created_at", 'YYYY-IW')`;
      case SalesPeriodUnit.MONTH:
        return Prisma.sql`TO_CHAR(o."created_at", 'YYYY-MM')`;
      case SalesPeriodUnit.YEAR:
        return Prisma.sql`TO_CHAR(o."created_at", 'YYYY')`;
      default:
        return Prisma.sql`TO_CHAR(o."created_at", 'YYYY-MM')`;
    }
  }

  // --- NOUVELLE MÉTHODE POUR LES STATISTIQUES D'INVENTAIRE ---
  async getInventoryDetails(
    businessId: string,
    userId: string,
    queryDto: QueryInventoryDto,
  ): Promise<InventoryDetailsDto> {
    await this.verifyBusinessOwnership(businessId, userId);

    const {
      page = 1,
      limit = 10,
      categoryId,
      search,
      startDate,
      endDate,
    } = queryDto;
    const skip = (page - 1) * limit;

    // Clauses WHERE communes
    const productWhereClause: Prisma.ProductWhereInput = { businessId };
    if (categoryId) productWhereClause.categoryId = categoryId;
    if (search) {
      productWhereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Clause de date pour les mouvements de stock
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const [
      currentInventoryValueRaw,
      totalUnitsInStockResult,
      productsLowStockRaw,
      expiringProductsRaw,
      lossesByMovementTypeRaw,
    ] = await this.prisma.$transaction([
      // 1. Valeur totale actuelle de l'inventaire
      this.prisma.$queryRaw<{ sum: number }[]>`
        SELECT COALESCE(SUM(pv.quantity_in_stock * pv.purchase_price), 0) as sum
        FROM "ProductVariant" pv
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE p."businessId" = ${businessId}
          ${categoryId ? Prisma.sql`AND p."category_id" = ${categoryId}` : Prisma.empty}
          ${search ? Prisma.sql`AND (p.name ILIKE ${'%' + search + '%'} OR p.description ILIKE ${'%' + search + '%'})` : Prisma.empty}
      `,

      // 2. Nombre total d'unités en stock
      this.prisma.productVariant.aggregate({
        where: { product: productWhereClause },
        _sum: { quantityInStock: true },
      }),

      // 3. Produits à stock bas (CORRECTION : Utilisation de $queryRaw)
      this.prisma.$queryRaw<LowStockProductItem[]>`
        SELECT
          pv.id as "variantId",
          pv.sku,
          p.name as "productName",
          pv.quantity_in_stock as "quantityInStock",
          pv.alert_threshold as "alertThreshold"
        FROM "ProductVariant" pv
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE p."businessId" = ${businessId}
          AND pv.alert_threshold IS NOT NULL -- S'assurer qu'un seuil est défini
          AND pv.alert_threshold > 0 -- S'assurer que le seuil n'est pas zéro ou négatif
          AND pv.quantity_in_stock <= pv.alert_threshold -- LA COMPARAIISON ENTRE COLONNES
          ${categoryId ? Prisma.sql`AND p."category_id" = ${categoryId}` : Prisma.empty}
          ${search ? Prisma.sql`AND (p.name ILIKE ${'%' + search + '%'} OR p.description ILIKE ${'%' + search + '%'})` : Prisma.empty}
        ORDER BY pv.quantity_in_stock ASC
        LIMIT ${limit} OFFSET ${skip}
      `,

      // 4. Produits proches de la péremption (utilise la même logique que InventoryService)
      this.prisma.productBatch.findMany({
        where: {
          variant: { product: productWhereClause },
          expirationDate: {
            lte: new Date(new Date().setDate(new Date().getDate() + 30)), // Dans les 30 prochains jours
            gte: new Date(),
          },
          quantity: { gt: 0 },
        },
        include: {
          variant: {
            include: { product: { select: { name: true } } },
          },
        },
        orderBy: { expirationDate: 'asc' },
        take: limit, // Paginer les résultats
        skip: skip,
      }),

      // 5. Pertes agrégées par type de mouvement sur la période
      this.prisma.$queryRaw<
        {
          movementType: MovementType;
          totalQuantity: bigint;
          totalValue: number;
        }[]
      >`
        SELECT
          sm.type as "movementType",
          COALESCE(SUM(ABS(sm.quantity_change)), 0) as "totalQuantity",
          COALESCE(SUM(ABS(sm.quantity_change) * pv.purchase_price), 0) as "totalValue"
        FROM "StockMovement" sm
        JOIN "ProductVariant" pv ON sm."variantId" = pv.id
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE p."businessId" = ${businessId}
          AND sm.type IN (${MovementType.LOSS}::"MovementType", ${MovementType.EXPIRATION}::"MovementType")
          ${startDate ? Prisma.sql`AND sm."created_at" >= ${new Date(startDate)}` : Prisma.empty}
          ${endDate ? Prisma.sql`AND sm."created_at" <= ${new Date(endDate)}` : Prisma.empty}
        GROUP BY sm.type
        ORDER BY sm.type ASC
      `,
    ]);

    const currentInventoryValue = currentInventoryValueRaw[0]?.sum || 0;
    const totalUnitsInStock =
      totalUnitsInStockResult._sum?.quantityInStock || 0;

    const productsLowStock: LowStockProductItem[] = productsLowStockRaw.map(
      (pv) => ({
        variantId: pv.variantId,
        sku: pv.sku || '',
        productName: pv.productName,
        quantityInStock: pv.quantityInStock || 0,
        alertThreshold: pv.alertThreshold || 0,
      }),
    );

    const expiringProducts: ExpiringProductItem[] = expiringProductsRaw.map(
      (pb) => ({
        batchId: pb.id,
        variantId: pb.variant.id,
        productName: pb.variant.product.name,
        quantity: pb.quantity,
        expirationDate: pb.expirationDate || undefined,
      }),
    );

    const lossesByMovementType: TotalLossesItem[] = lossesByMovementTypeRaw.map(
      (item) => ({
        movementType: item.movementType,
        totalQuantity: Number(item.totalQuantity),
        totalValue: item.totalValue,
      }),
    );

    return {
      currentInventoryValue,
      totalUnitsInStock,
      productsLowStock,
      expiringProducts,
      lossesByMovementType,
    };
  }

  // --- NOUVELLE MÉTHODE POUR LES STATISTIQUES CLIENT ---
  async getCustomerDetails(
    businessId: string,
    userId: string,
    queryDto: QueryCustomersDto,
  ): Promise<CustomerDetailsDto> {
    await this.verifyBusinessOwnership(businessId, userId);

    const { page = 1, limit = 10, search, startDate, endDate } = queryDto;
    const skip = (page - 1) * limit;

    // Clause de date pour les commandes
    const dateFilterConditions: string[] = [];
    if (startDate)
      dateFilterConditions.push(
        `o."created_at" >= '${new Date(startDate).toISOString()}'`,
      );
    if (endDate)
      dateFilterConditions.push(
        `o."created_at" <= '${new Date(endDate).toISOString()}'`,
      );
    const dateWhereClause =
      dateFilterConditions.length > 0
        ? `AND ${dateFilterConditions.join(' AND ')}`
        : '';

    // Clause de recherche pour le client
    const searchFilterConditions: string[] = [];
    if (search) {
      searchFilterConditions.push(
        `(u."firstName" ILIKE ${'%' + search + '%'} OR u."lastName" ILIKE ${'%' + search + '%'})`,
      );
    }
    const searchWhereClause =
      searchFilterConditions.length > 0
        ? `AND ${searchFilterConditions.join(' AND ')}`
        : '';

    // Requête RAW pour les meilleurs clients
    // C'est complexe car nous voulons agréger les commandes par client, puis filtrer/paginer
    const topCustomersRaw = await this.prisma.$queryRaw<TopCustomerItem[]>`
      SELECT
        u.id as "customerId",
        u."firstName",
        u."lastName",
        u."profileImageUrl",
        COUNT(o.id) as "totalOrdersPlaced",
        COALESCE(SUM(o."total_amount"), 0) as "totalAmountSpent"
      FROM "User" u
      JOIN "Order" o ON u.id = o."customerId"
      WHERE o."businessId" = ${businessId}
        AND o.type = ${OrderType.SALE}::"OrderType"
        AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
        ${Prisma.sql`${dateWhereClause}`}
        ${Prisma.sql`${searchWhereClause}`}
      GROUP BY u.id, u."firstName", u."lastName", u."profileImageUrl"
      ORDER BY "totalAmountSpent" DESC, "totalOrdersPlaced" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // Requête RAW pour compter le nombre total de clients uniques correspondant aux filtres
    const totalCustomersCountRaw = await this.prisma.$queryRaw<
      { count: bigint }[]
    >`
      SELECT COUNT(DISTINCT u.id) as count
      FROM "User" u
      JOIN "Order" o ON u.id = o."customerId"
      WHERE o."businessId" = ${businessId}
        AND o.type = ${OrderType.SALE}::"OrderType"
        AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
        ${Prisma.sql`${dateWhereClause}`}
        ${Prisma.sql`${searchWhereClause}`}
    `;
    const totalCustomers = totalCustomersCountRaw[0]?.count
      ? Number(totalCustomersCountRaw[0].count)
      : 0;

    const topCustomers: TopCustomerItem[] = topCustomersRaw.map((item) => ({
      customerId: item.customerId,
      firstName: item.firstName,
      lastName: item.lastName,
      profileImageUrl: item.profileImageUrl,
      totalOrdersPlaced: Number(item.totalOrdersPlaced),
      totalAmountSpent: item.totalAmountSpent,
    }));

    return {
      topCustomers,
      total: totalCustomers,
      page,
      limit,
      totalPages: Math.ceil(totalCustomers / limit),
    };
  }

  // --- NOUVELLE MÉTHODE POUR LES STATISTIQUES DE RESTAURANT ---
  async getRestaurantDetails(
    businessId: string,
    userId: string,
    queryDto: QueryRestaurantDto,
  ): Promise<RestaurantDetailsDto> {
    const business = await this.verifyBusinessOwnership(businessId, userId);

    if (business.type !== BusinessType.RESTAURATEUR) {
      throw new BadRequestException(
        'Cet endpoint est uniquement pour les entreprises de type RESTAURATEUR.',
      );
    }

    const { startDate, endDate, unit = SalesPeriodUnit.MONTH } = queryDto; // unité par défaut pour les réservations

    const dateFilterConditions: string[] = [];
    if (startDate)
      dateFilterConditions.push(
        `o."createdAt" >= '${new Date(startDate).toISOString()}'`,
      );
    if (endDate)
      dateFilterConditions.push(
        `o."createdAt" <= '${new Date(endDate).toISOString()}'`,
      );
    const dateWhereClause =
      dateFilterConditions.length > 0
        ? `AND ${dateFilterConditions.join(' AND ')}`
        : '';

    const [
      totalReservationsResult,
      totalDishOrdersResult,
      popularDishesRaw,
      reservationsByPeriodRaw,
    ] = await this.prisma.$transaction([
      // 1. Nombre total de réservations
      this.prisma.order.count({
        where: {
          businessId,
          type: OrderType.RESERVATION,
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
          createdAt: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
      }),

      // 2. Nombre total de commandes de plats (ventes B2C vers le restaurant)
      this.prisma.order.count({
        where: {
          businessId,
          type: OrderType.SALE, // Les plats sont vendus
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          createdAt: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
      }),

      // 3. Plats les plus populaires (basé sur les quantités vendues ou réservées)
      this.prisma.$queryRaw<PopularDishItem[]>`
        SELECT
          pv.id as "variantId",
          p.name as "dishName",
          pv."imageUrl" as "dishImageUrl",
          COALESCE(SUM(ol.quantity), 0) as "totalQuantityOrdered",
          COALESCE(SUM(ol.quantity * ol.price), 0) as "totalRevenue"
        FROM "OrderLine" ol
        JOIN "Order" o ON ol."orderId" = o.id
        JOIN "ProductVariant" pv ON ol."variantId" = pv.id
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE o."businessId" = ${businessId}
          AND o.type IN (${OrderType.SALE}::"OrderType", ${OrderType.RESERVATION}::"OrderType") -- Prend en compte ventes et pré-commandes
          AND o.status IN (${OrderStatus.DELIVERED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus", ${OrderStatus.CONFIRMED}::"OrderStatus")
          ${Prisma.sql`${dateWhereClause}`}
        GROUP BY pv.id, p.name, pv."imageUrl"
        ORDER BY "totalQuantityOrdered" DESC
        LIMIT 10
      `,

      // 4. Réservations agrégées par période
      this.prisma.$queryRaw<ReservationsByPeriodItem[]>`
        SELECT
          ${this.getPeriodFormat(unit)} as period,
          COUNT(o.id) as "totalReservations"
        FROM "Order" o
        WHERE o."businessId" = ${businessId}
          AND o.type = ${OrderType.RESERVATION}::"OrderType"
          AND o.status IN (${OrderStatus.CONFIRMED}::"OrderStatus", ${OrderStatus.COMPLETED}::"OrderStatus")
          ${Prisma.sql`${dateWhereClause}`}
        GROUP BY period
        ORDER BY period ASC
      `,
    ]);

    const totalReservations = totalReservationsResult;
    const totalDishOrders = totalDishOrdersResult;

    const popularDishes: PopularDishItem[] = popularDishesRaw.map((item) => ({
      variantId: item.variantId,
      dishName: item.dishName,
      dishImageUrl: item.dishImageUrl,
      totalQuantityOrdered: Number(item.totalQuantityOrdered),
      totalRevenue: item.totalRevenue,
    }));

    const reservationsByPeriod: ReservationsByPeriodItem[] =
      reservationsByPeriodRaw.map((item) => ({
        period: item.period,
        totalReservations: Number(item.totalReservations),
      }));

    // Calcul de l'occupation moyenne des tables serait plus complexe et nécessiterait
    // des données sur la capacité des tables et l'historique des réservations plus fines.
    // Pour l'instant, nous le laissons optionnel ou à 0.
    const averageTableOccupancy = 0; // Calcul à implémenter si les données sont disponibles

    return {
      totalReservations,
      totalDishOrders,
      popularDishes,
      reservationsByPeriod,
      averageTableOccupancy,
    };
  }

  // --- MÉTHODE MODIFIÉE POUR LES STATISTIQUES DES MEMBRES ---
  async getMemberOverview(
    businessId: string, // Ajout de l'ID de l'entreprise
    memberId: string, // L'ID du membre dont on veut voir les stats
    requestingUserId: string, // L'ID de la personne qui fait la demande
    queryDto: QueryMemberOverviewDto,
  ): Promise<MemberOverviewDto> {
    // 1. Vérification de l'existence de l'entreprise
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) {
      throw new NotFoundException('Entreprise non trouvée.');
    }

    // 2. Vérification de l'existence du membre
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, firstName: true, lastName: true }, // Pour confirmation
    });
    if (!member) {
      throw new NotFoundException('Membre non trouvé.');
    }

    // 3. Vérification de l'autorisation :
    //    a) Le demandeur est le membre lui-même, OU
    //    b) Le demandeur est le propriétaire de l'entreprise, OU
    //    c) Le demandeur est un ADMIN de l'entreprise.
    const isSelf = memberId === requestingUserId;
    const isOwner = business.ownerId === requestingUserId;
    const isAdminOfBusiness = await this.prisma.businessMember.findUnique({
      where: {
        userId_businessId: { userId: requestingUserId, businessId: businessId },
        role: 'ADMIN',
      },
    });

    if (!isSelf && !isOwner && !isAdminOfBusiness) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à consulter les statistiques de ce membre.",
      );
    }

    // Le reste de la logique utilise maintenant 'memberId' comme 'employeeId'
    const { startDate, endDate } = queryDto;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const rawDateFilter: string[] = [];
    if (startDate)
      rawDateFilter.push(
        `"createdAt" >= '${new Date(startDate).toISOString()}'`,
      );
    if (endDate)
      rawDateFilter.push(`"createdAt" <= '${new Date(endDate).toISOString()}'`);
    const rawDateWhereClause =
      rawDateFilter.length > 0 ? `AND ${rawDateFilter.join(' AND ')}` : '';

    const [
      salesProcessedAggregates,
      productsSoldAggregates,
      purchaseInitiatedAggregates,
      reservationsManagedAggregates,
      inventoryAdjustmentsCount,
      totalLossesManagedRaw,
    ] = await this.prisma.$transaction([
      // 1. Ventes traitées (où le membre est l'employé associé à la commande)
      this.prisma.order.aggregate({
        where: {
          businessId, // Filtrer sur l'entreprise du membre
          employeeId: memberId, // Stats pour CE membre
          type: OrderType.SALE,
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
          createdAt: dateFilter,
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // 2. Produits vendus par ce membre (via OrderLine où le membre est l'employé)
      this.prisma.orderLine.aggregate({
        where: {
          order: {
            businessId,
            employeeId: memberId, // Stats pour CE membre
            type: OrderType.SALE,
            status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
            createdAt: dateFilter,
          },
        },
        _sum: { quantity: true },
      }),

      // 3. Commandes d'achat initiées par ce membre
      this.prisma.order.aggregate({
        where: {
          purchasingBusinessId: businessId, // L'entreprise ACHÈTE (pour filtrer les achats liés à cette entreprise)
          employeeId: memberId, // Stats pour CE membre
          type: OrderType.PURCHASE,
          status: {
            in: [
              OrderStatus.DELIVERED,
              OrderStatus.COMPLETED,
              OrderStatus.SHIPPED,
            ],
          },
          createdAt: dateFilter,
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // 4. Réservations gérées par ce membre (si c'est un employé de restaurant)
      this.prisma.order.aggregate({
        where: {
          businessId,
          employeeId: memberId, // Stats pour CE membre
          type: OrderType.RESERVATION,
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
          createdAt: dateFilter,
        },
        _count: { id: true },
      }),

      // 5. Ajustements d'inventaire effectués par ce membre
      this.prisma.stockMovement.count({
        where: {
          businessId,
          performedById: memberId, // Stats pour CE membre
          type: MovementType.ADJUSTMENT,
          createdAt: dateFilter,
        },
      }),

      // 6. Valeur totale des pertes (LOSS, EXPIRATION) gérées par ce membre (requête RAW)
      this.prisma.$queryRaw<{ totalLosses: number }[]>`
        SELECT COALESCE(SUM(ABS(sm.quantity_change) * pv.purchase_price), 0) as "totalLosses"
        FROM "StockMovement" sm
        JOIN "ProductVariant" pv ON sm."variantId" = pv.id
        JOIN "Product" p ON pv."product_id" = p.id
        WHERE p."businessId" = ${businessId}
          AND sm."performedById" = ${memberId} -- Stats pour CE membre
          AND sm.type IN (${MovementType.LOSS}::"MovementType", ${MovementType.EXPIRATION}::"MovementType")
          ${Prisma.sql`${rawDateWhereClause}`}
      `,
    ]);

    const totalSalesProcessed =
      salesProcessedAggregates._sum?.totalAmount?.toNumber() || 0;
    const totalSalesOrdersProcessed = salesProcessedAggregates._count?.id || 0;
    const totalProductsSold = productsSoldAggregates._sum?.quantity || 0;
    const totalPurchaseAmountInitiated =
      purchaseInitiatedAggregates._sum?.totalAmount?.toNumber() || 0;
    const totalPurchaseOrdersInitiated =
      purchaseInitiatedAggregates._count?.id || 0;
    const totalReservationsManaged =
      reservationsManagedAggregates._count?.id || 0;
    const totalInventoryAdjustments = inventoryAdjustmentsCount;
    const totalLossesManaged = totalLossesManagedRaw[0]?.totalLosses || 0;

    return {
      totalSalesProcessed,
      totalSalesOrdersProcessed,
      totalProductsSold,
      totalPurchaseAmountInitiated,
      totalPurchaseOrdersInitiated,
      totalReservationsManaged,
      totalInventoryAdjustments,
      totalLossesManaged,
    };
  }
}
