// src/products/products.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { Prisma } from '@prisma/client';
import { QueryProductsDto, ProductSortBy } from './dto/query-products.dto';
import { CurrenciesService } from 'src/currencies/currencies.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryProductListDto } from './dto/query-business-products.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currenciesService: CurrenciesService, // INJECTER
  ) {}

  // --- Gestion des Produits Templates ---
  async createProduct(
    businessId: string,
    userId: string,
    dto: CreateProductDto,
  ) {
    await this.verifyUserIsBusinessOwner(businessId, userId);
    return this.prisma.product.create({
      data: { ...dto, businessId },
    });
  }

  // --- Gestion des Variantes ---
  async createVariant(
    productId: string,
    userId: string,
    dto: CreateVariantDto,
  ) {
    const product = await this.findProductById(productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);

    // Valider que les attributs fournis correspondent à la catégorie du produit
    await this.validateAttributes(product.categoryId, dto.attributes);

    return this.prisma.$transaction(async (tx) => {
      // 1. Créer la variante de base
      const variant = await tx.productVariant.create({
        data: {
          productId,
          price: dto.price,
          purchasePrice: dto.purchasePrice,
          quantityInStock: dto.quantityInStock,
          sku: dto.sku,
          barcode: dto.barcode,
          itemsPerLot: dto.itemsPerLot,
          lotPrice: dto.lotPrice,
        },
      });

      // 2. Créer les liens vers les valeurs d'attributs
      await tx.variantAttributeValue.createMany({
        data: dto.attributes.map((attr) => ({
          variantId: variant.id,
          attributeId: attr.attributeId,
          value: attr.value,
        })),
      });

      // 3. (Optionnel mais recommandé) Créer le premier mouvement de stock
      if (dto.quantityInStock > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            businessId: product.businessId,
            performedById: userId,
            type: 'INITIAL_STOCK',
            quantityChange: dto.quantityInStock,
            newQuantity: dto.quantityInStock,
            reason: 'Création de la variante',
          },
        });
      }

      return this.findVariantById(variant.id, tx); // Retourner la variante complète
    });
  }

  // --- Fonctions de Consultation ---
  async findProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { include: { attributes: true } },
        variants: {
          include: { attributeValues: { include: { attribute: true } } },
        },
      },
    });
    if (!product) throw new NotFoundException('Produit non trouvé.');
    return product;
  }

  async findVariantById(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    return db.productVariant.findUnique({
      where: { id },
      include: { attributeValues: { include: { attribute: true } } },
    });
  }

  // --- Fonctions d'Aide et de Validation ---
  private async verifyUserIsBusinessOwner(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Entreprise non trouvée.');
    if (business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }
  }

  private async validateAttributes(
    categoryId: string,
    attributes: { attributeId: string; value: string }[],
  ) {
    const categoryAttributes = await this.prisma.categoryAttribute.findMany({
      where: { categoryId },
    });
    const categoryAttributeIds = new Set(categoryAttributes.map((a) => a.id));

    if (attributes.length !== categoryAttributeIds.size) {
      throw new BadRequestException(
        "Le nombre d'attributs fournis ne correspond pas à celui de la catégorie.",
      );
    }

    for (const attr of attributes) {
      if (!categoryAttributeIds.has(attr.attributeId)) {
        throw new BadRequestException(
          `L'attribut avec l'ID ${attr.attributeId} n'appartient pas à la catégorie de ce produit.`,
        );
      }
    }
  }

  async search(dto: QueryProductsDto) {
    const {
      page = 1,
      limit = 20,
      currencyCode = 'EUR',
      latitude,
      longitude,
      sortBy = ProductSortBy.RELEVANCE,
      ...filters
    } = dto;
    const offset = (page - 1) * limit;

    // 1. Obtenir le taux de change pour la devise du client
    const targetCurrency =
      await this.currenciesService.findByCode(currencyCode);
    if (!targetCurrency) {
      throw new BadRequestException(
        `La devise ${currencyCode} n'est pas supportée.`,
      );
    }
    const exchangeRate = targetCurrency.exchangeRate;

    // 2. Construction dynamique de la requête SQL
    const params: any[] = [];
    let paramIndex = 1;

    let query = `
      SELECT
        pv.id, pv.price, pv.sku, pv."imageUrl", p.name, p."imageUrl" as "productImageUrl", b.name as "businessName",
        -- Calcul du prix converti
        (pv.price / c."exchange_rate" * ${exchangeRate}) as "convertedPrice"
        ${
          latitude !== undefined && longitude !== undefined
            ? `,
        -- Calcul de la distance si les coordonnées sont fournies
        (ST_Distance(
          b.location,
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) / 1000) as "distanceKm"
        `
            : ''
        }
      FROM "ProductVariant" pv
      JOIN "Product" p ON pv."productId" = p.id
      JOIN "Business" b ON p."businessId" = b.id
      JOIN "Currency" c ON b."currencyId" = c.id
      WHERE pv."quantityInStock" > 0
    `;

    // Filtres dynamiques
    if (filters.search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR pv.sku ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters.categoryId) {
      query += ` AND p."categoryId" = $${paramIndex}`;
      params.push(filters.categoryId);
      paramIndex++;
    }
    // ... Ajoutez d'autres filtres (businessType, etc.) de la même manière

    // Construction d'une sous-requête pour filtrer sur les champs calculés
    let finalQuery = `SELECT * FROM (${query}) AS results WHERE 1=1`;

    if (filters.minPrice !== undefined) {
      finalQuery += ` AND "convertedPrice" >= $${paramIndex}`;
      params.push(filters.minPrice);
      paramIndex++;
    }
    if (filters.maxPrice !== undefined) {
      finalQuery += ` AND "convertedPrice" <= $${paramIndex}`;
      params.push(filters.maxPrice);
      paramIndex++;
    }
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      filters.radius !== undefined
    ) {
      finalQuery += ` AND "distanceKm" <= $${paramIndex}`;
      params.push(filters.radius);
      paramIndex++;
    }

    // Requête pour compter le total des résultats (pour la pagination)
    const countQuery = `SELECT COUNT(*) FROM (${finalQuery}) as count_results`;
    const totalResult: any[] = await this.prisma.$queryRawUnsafe(
      countQuery,
      ...params,
    );
    const total = Number(totalResult[0].count);

    // Tri
    switch (sortBy) {
      case ProductSortBy.PRICE_ASC:
        finalQuery += ' ORDER BY "convertedPrice" ASC';
        break;
      case ProductSortBy.PRICE_DESC:
        finalQuery += ' ORDER BY "convertedPrice" DESC';
        break;
      case ProductSortBy.DISTANCE:
        if (latitude !== undefined && longitude !== undefined) {
          finalQuery += ' ORDER BY "distanceKm" ASC';
        }
        break;
      // Par défaut (RELEVANCE), pas de tri spécifique, la BDD choisit
    }

    // Pagination
    finalQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const results = await this.prisma.$queryRawUnsafe(finalQuery, ...params);

    return {
      data: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateProductImage(
    productId: string,
    userId: string,
    imageUrl: string,
  ) {
    const product = await this.findProductById(productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);
    return this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });
  }

  async updateVariantImage(
    variantId: string,
    userId: string,
    imageUrl: string,
  ) {
    const variant = await this.findVariantById(variantId);
    if (!variant) throw new NotFoundException('Variante non trouvée.');
    const product = await this.findProductById(variant.productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { imageUrl },
    });
  }

  // --- NOUVELLES MÉTHODES DE GESTION (UPDATE & DELETE) ---

  async updateProduct(
    productId: string,
    userId: string,
    dto: UpdateProductDto,
  ) {
    const product = await this.findProductById(productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);

    return this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });
  }

  async removeProduct(productId: string, userId: string) {
    const product = await this.findProductById(productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);

    // La suppression est en cascade (configurée dans Prisma),
    // donc supprimer le produit supprimera aussi ses variantes et leurs relations.
    await this.prisma.product.delete({
      where: { id: productId },
    });

    return {
      message: `Le produit "${product.name}" et toutes ses variantes ont été supprimés.`,
    };
  }

  async updateVariant(
    variantId: string,
    userId: string,
    dto: UpdateVariantDto,
  ) {
    const variant = await this.findVariantById(variantId);
    if (!variant) throw new NotFoundException('Variante non trouvée.');

    const product = await this.findProductById(variant.productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);

    // Note : Nous ne permettons pas de changer les attributs, car cela change l'identité de la variante.
    // L'utilisateur devrait supprimer et recréer si les attributs sont mauvais.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { attributes, ...updateData } = dto;

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });
  }

  async removeVariant(variantId: string, userId: string) {
    const variant = await this.findVariantById(variantId);
    if (!variant) throw new NotFoundException('Variante non trouvée.');

    const product = await this.findProductById(variant.productId);
    await this.verifyUserIsBusinessOwner(product.businessId, userId);

    await this.prisma.productVariant.delete({
      where: { id: variantId },
    });

    return { message: 'La variante a été supprimée avec succès.' };
  }

  // --- NOUVELLE MÉTHODE DE LISTAGE PAR ENTREPRISE ---

  async findAllByBusiness(businessId: string, queryDto: QueryProductListDto) {
    const { page = 1, limit = 10, search, categoryId } = queryDto;
    const skip = (page - 1) * limit;

    // Construction dynamique de la clause WHERE
    const where: Prisma.ProductWhereInput = {
      businessId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        // On peut même rechercher dans les SKU des variantes
        {
          variants: {
            some: { sku: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where, // Appliquer le filtre
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          variants: {
            include: {
              attributeValues: { include: { attribute: true } },
            },
          },
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }), // Compter avec le même filtre
    ]);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- GESTION DES AVIS ---

  // Méthode privée pour centraliser la logique de mise à jour des agrégats
  private async _updateProductReviewAggregates(
    productId: string,
    tx: Prisma.TransactionClient,
  ) {
    const aggregates = await tx.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true },
    });
    const avgRating = aggregates._avg.rating || 0;
    const reviewCount = aggregates._count.id || 0;

    return tx.product.update({
      where: { id: productId },
      data: {
        averageRating: parseFloat(avgRating.toFixed(2)),
        reviewCount: reviewCount,
      },
    });
  }

  async createReview(
    productId: string,
    authorId: string,
    dto: CreateReviewDto,
  ) {
    // La contrainte @@unique dans Prisma gère déjà la prévention des doublons,
    // mais une vérification préalable peut donner un meilleur message d'erreur.
    const existingReview = await this.prisma.review.findFirst({
      where: { AND: [{ productId }, { authorId }] },
    });
    if (existingReview) {
      throw new ConflictException(
        'Vous avez déjà laissé un avis pour ce produit.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: { ...dto, productId, authorId },
      });
      return this._updateProductReviewAggregates(productId, tx);
    });
  }

  async findAllReviews(productId: string, { page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      data: reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- GESTION DES FAVORIS ---

  async addFavorite(productId: string, userId: string) {
    // Utiliser upsert pour une opération idempotente : si le favori existe, ne rien faire.
    // Si non, le créer.
    await this.prisma.favoriteProduct.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return { message: 'Produit ajouté aux favoris.' };
  }

  async removeFavorite(productId: string, userId: string) {
    try {
      await this.prisma.favoriteProduct.delete({
        where: { userId_productId: { userId, productId } },
      });
      return { message: 'Produit retiré des favoris.' };
    } catch (error) {
      // Ignorer l'erreur si le favori n'existait pas, car le résultat est le même.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { message: 'Produit retiré des favoris.' };
      }
      throw error;
    }
  }
}
