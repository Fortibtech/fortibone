// src/inventory/inventory.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, Prisma } from '@prisma/client';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AddBatchDto } from './dto/add-batch.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // Vérifie que l'utilisateur est bien le propriétaire de l'entreprise qui possède la variante
  private async verifyOwnership(
    variantId: string,
    userId: string,
  ): Promise<{ businessId: string; variant: any }> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { business: true } } },
    });

    if (!variant) {
      throw new NotFoundException('Variante de produit non trouvée.');
    }
    if (variant.product.business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à gérer l'inventaire de cette entreprise.",
      );
    }

    return { businessId: variant.product.businessId, variant };
  }

  async adjustStock(variantId: string, userId: string, dto: AdjustStockDto) {
    const { businessId, variant } = await this.verifyOwnership(
      variantId,
      userId,
    );
    const { quantityChange, type, reason } = dto;

    if (quantityChange === 0) {
      throw new BadRequestException(
        'La quantité à ajuster ne peut pas être zéro.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (quantityChange < 0) {
        // --- LOGIQUE DE DÉCRÉMENTATION (FEFO) ---
        return this.decrementStockFromBatches(tx, {
          variantId,
          businessId,
          userId,
          quantityToRemove: Math.abs(quantityChange),
          movementType: type,
          reason,
        });
      } else {
        // --- LOGIQUE D'INCRÉMENTATION (Création d'un nouveau lot) ---
        return this.incrementStockAsNewBatch(tx, {
          variantId,
          businessId,
          userId,
          quantityToAdd: quantityChange,
          movementType: type,
          reason,
        });
      }
    });
  }

  // Méthode privée pour gérer la sortie de stock (FEFO)
  private async decrementStockFromBatches(
    tx: Prisma.TransactionClient,
    params: {
      variantId: string;
      businessId: string;
      userId: string;
      quantityToRemove: number;
      movementType: MovementType;
      reason?: string;
    },
  ) {
    const {
      variantId,
      businessId,
      userId,
      quantityToRemove,
      movementType,
      reason,
    } = params;

    const currentStock = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { quantityInStock: true },
    });

    if (!currentStock) {
      throw new NotFoundException('Variante de produit non trouvée.');
    }

    if (currentStock.quantityInStock < quantityToRemove) {
      throw new BadRequestException(
        `Stock insuffisant. Quantité demandée : ${quantityToRemove}, stock disponible : ${currentStock.quantityInStock}.`,
      );
    }

    // Récupérer les lots avec du stock, triés par date de péremption (les plus proches en premier)
    // Les lots sans date de péremption sont traités en dernier (considérés comme expirant "à l'infini")
    const batches = await tx.productBatch.findMany({
      where: { variantId, quantity: { gt: 0 } },
      orderBy: { expirationDate: 'asc' }, // 'asc' met les nulls à la fin par défaut
    });

    let remainingToRemove = quantityToRemove;

    for (const batch of batches) {
      if (remainingToRemove <= 0) break;

      const quantityInBatch = batch.quantity;
      const amountToRemoveFromBatch = Math.min(
        quantityInBatch,
        remainingToRemove,
      );

      await tx.productBatch.update({
        where: { id: batch.id },
        data: { quantity: { decrement: amountToRemoveFromBatch } },
      });

      remainingToRemove -= amountToRemoveFromBatch;
    }

    if (remainingToRemove > 0) {
      // Cette erreur ne devrait jamais se produire si le stock total est correct,
      // mais c'est une sécurité contre la désynchronisation des données.
      throw new InternalServerErrorException(
        'Désynchronisation du stock. La somme des lots ne correspond pas au stock total.',
      );
    }

    // Mettre à jour la quantité totale et créer le mouvement de stock
    const updatedVariant = await tx.productVariant.update({
      where: { id: variantId },
      data: { quantityInStock: { decrement: quantityToRemove } },
    });

    await tx.stockMovement.create({
      data: {
        variantId,
        businessId,
        performedById: userId,
        type: movementType,
        quantityChange: -quantityToRemove,
        newQuantity: updatedVariant.quantityInStock,
        reason,
      },
    });

    return updatedVariant;
  }

  // Méthode privée pour gérer l'entrée de stock (correction, retour)
  private async incrementStockAsNewBatch(
    tx: Prisma.TransactionClient,
    params: {
      variantId: string;
      businessId: string;
      userId: string;
      quantityToAdd: number;
      movementType: MovementType;
      reason?: string;
    },
  ) {
    const {
      variantId,
      businessId,
      userId,
      quantityToAdd,
      movementType,
      reason,
    } = params;

    // L'approche la plus simple et la plus sûre est de créer un nouveau lot.
    // On ne lui met pas de date de péremption car elle est inconnue.
    await tx.productBatch.create({
      data: {
        variantId,
        quantity: quantityToAdd,
      },
    });

    const updatedVariant = await tx.productVariant.update({
      where: { id: variantId },
      data: { quantityInStock: { increment: quantityToAdd } },
    });

    await tx.stockMovement.create({
      data: {
        variantId,
        businessId,
        performedById: userId,
        type: movementType,
        quantityChange: quantityToAdd,
        newQuantity: updatedVariant.quantityInStock,
        reason,
      },
    });

    return updatedVariant;
  }

  async getVariantHistory(variantId: string, userId: string) {
    await this.verifyOwnership(variantId, userId);

    return this.prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { id: true, firstName: true } },
        order: { select: { id: true, orderNumber: true } }, // Pour voir si le mouvement vient d'une commande
      },
    });
  }

  async getBusinessInventory(
    businessId: string,
    userId: string,
    { page = 1, limit = 20 },
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business || business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à consulter cet inventaire.",
      );
    }

    const skip = (page - 1) * limit;

    const [variants, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where: { product: { businessId } },
        skip,
        take: limit,
        orderBy: { product: { name: 'asc' } },
        include: {
          product: { select: { name: true } },
          attributeValues: { include: { attribute: true } },
        },
      }),
      this.prisma.productVariant.count({ where: { product: { businessId } } }),
    ]);

    return {
      data: variants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- NOUVELLE FONCTION POUR AJOUTER UN LOT ---
  async addBatch(variantId: string, userId: string, dto: AddBatchDto) {
    const { businessId } = await this.verifyOwnership(variantId, userId);
    const { quantity, expirationDate } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Créer le nouveau lot
      await tx.productBatch.create({
        data: {
          variantId,
          quantity,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
        },
      });

      // 2. Mettre à jour la quantité totale sur la variante (dénormalisation)
      const updatedVariant = await tx.productVariant.update({
        where: { id: variantId },
        data: { quantityInStock: { increment: quantity } },
      });

      // 3. Créer le mouvement de stock pour la traçabilité
      await tx.stockMovement.create({
        data: {
          variantId,
          businessId,
          performedById: userId,
          type: 'PURCHASE_ENTRY', // L'ajout d'un lot est une entrée de stock
          quantityChange: quantity,
          newQuantity: updatedVariant.quantityInStock,
          reason: `Réception d'un nouveau lot`,
        },
      });

      return updatedVariant;
    });
  }

  // --- NOUVELLE FONCTION POUR IDENTIFIER LES PRODUITS À PÉREMPTION PROCHE ---
  async findExpiringSoon(
    businessId: string,
    userId: string,
    daysUntilExpiration: number,
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business || business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilExpiration);

    return this.prisma.productBatch.findMany({
      where: {
        variant: { product: { businessId } },
        expirationDate: {
          lte: targetDate, // lte = Less Than or Equal
          gte: new Date(), // gte = Greater Than or Equal (pour ne pas inclure les déjà périmés)
        },
        quantity: { gt: 0 }, // Uniquement les lots avec du stock
      },
      include: {
        variant: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  // --- NOUVELLE FONCTION POUR DÉCLARER LA PERTE DES PRODUITS PÉRIMÉS ---
  async recordExpiredLosses(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business || business.ownerId !== userId) {
      throw new ForbiddenException('Action non autorisée.');
    }

    // 1. Trouver tous les lots périmés avec du stock
    const expiredBatches = await this.prisma.productBatch.findMany({
      where: {
        variant: { product: { businessId } },
        expirationDate: { lte: new Date() },
        quantity: { gt: 0 },
      },
    });

    if (expiredBatches.length === 0) {
      return {
        message: 'Aucun produit périmé à déclarer en perte.',
        lossesRecorded: 0,
      };
    }

    // 2. Utiliser une transaction pour traiter toutes les pertes
    return this.prisma.$transaction(async (tx) => {
      let totalLoss = 0;
      for (const batch of expiredBatches) {
        const lossQuantity = batch.quantity;
        totalLoss += lossQuantity;

        // a. Mettre à jour la variante
        const updatedVariant = await tx.productVariant.update({
          where: { id: batch.variantId },
          data: { quantityInStock: { decrement: lossQuantity } },
        });

        // b. Créer le mouvement de stock
        await tx.stockMovement.create({
          data: {
            variantId: batch.variantId,
            businessId,
            performedById: userId,
            type: 'EXPIRATION',
            quantityChange: -lossQuantity,
            newQuantity: updatedVariant.quantityInStock,
            reason: `Produit périmé (Lot #${batch.id.substring(0, 8)})`,
          },
        });

        // c. Mettre à jour le lot pour vider son stock
        await tx.productBatch.update({
          where: { id: batch.id },
          data: { quantity: 0 },
        });
      }
      return {
        message: `${totalLoss} unité(s) ont été déclarées comme pertes dues à la péremption.`,
        lossesRecorded: totalLoss,
      };
    });
  }
}
