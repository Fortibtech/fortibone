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
import { QueryBatchesDto } from './dto/query-batches.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

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
    const { quantityChange, type, reason, batchId } = dto;

    if (quantityChange === 0) {
      throw new BadRequestException(
        'La quantité à ajuster ne peut pas être zéro.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (quantityChange < 0) {
        // --- LOGIQUE DE DÉCRÉMENTATION ---
        const quantityToRemove = Math.abs(quantityChange);

        if (batchId) {
          // Scénario 1 : Ajustement sur un lot spécifique
          return this.decrementStockFromSpecificBatch(tx, {
            variantId,
            businessId,
            userId,
            batchId,
            quantityToRemove,
            movementType: type,
            reason,
          });
        } else {
          // Scénario 2 : Ajustement FEFO (comportement par défaut)
          return this.decrementStockFromBatches(tx, {
            variantId,
            businessId,
            userId,
            quantityToRemove,
            movementType: type,
            reason,
          });
        }
      } else {
        // --- LOGIQUE D'INCRÉMENTATION (ne change pas) ---
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

  // --- NOUVELLE MÉTHODE PRIVÉE POUR AJUSTER UN LOT SPÉCIFIQUE ---
  private async decrementStockFromSpecificBatch(
    tx: Prisma.TransactionClient,
    params: {
      variantId: string;
      businessId: string;
      userId: string;
      batchId: string;
      quantityToRemove: number;
      movementType: MovementType;
      reason?: string;
    },
  ) {
    const {
      variantId,
      businessId,
      userId,
      batchId,
      quantityToRemove,
      movementType,
      reason,
    } = params;

    const batch = await tx.productBatch.findUnique({ where: { id: batchId } });

    // Vérifications de sécurité
    if (!batch) {
      throw new NotFoundException(
        `Le lot avec l'ID ${batchId} n'a pas été trouvé.`,
      );
    }
    if (batch.variantId !== variantId) {
      throw new BadRequestException(
        "Le lot spécifié n'appartient pas à la bonne variante de produit.",
      );
    }
    if (batch.quantity < quantityToRemove) {
      throw new BadRequestException(
        `Stock insuffisant dans le lot spécifié. Demandé: ${quantityToRemove}, disponible: ${batch.quantity}.`,
      );
    }

    // 1. Mettre à jour la quantité du lot spécifique
    await tx.productBatch.update({
      where: { id: batchId },
      data: { quantity: { decrement: quantityToRemove } },
    });

    // 2. Mettre à jour la quantité totale sur la variante
    const updatedVariant = await tx.productVariant.update({
      where: { id: variantId },
      data: { quantityInStock: { decrement: quantityToRemove } },
    });

    // 3. Créer le mouvement de stock pour la traçabilité
    await tx.stockMovement.create({
      data: {
        variantId,
        businessId,
        performedById: userId,
        type: movementType,
        quantityChange: -quantityToRemove,
        newQuantity: updatedVariant.quantityInStock,
        reason: reason
          ? `${reason} (Lot #${batchId.substring(0, 8)})`
          : `Ajustement (Lot #${batchId.substring(0, 8)})`,
      },
    });

    return updatedVariant;
  }

  // Méthode privée pour gérer la sortie de stock (FEFO)
  async decrementStockFromBatches(
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
  async incrementStockAsNewBatch(
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

  // --- NOUVELLES MÉTHODES DE GESTION DES LOTS ---

  async findAllBatchesForVariant(
    variantId: string,
    userId: string,
    queryDto: QueryBatchesDto,
  ) {
    await this.verifyOwnership(variantId, userId);
    const { page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const [batches, total] = await this.prisma.$transaction([
      this.prisma.productBatch.findMany({
        where: { variantId },
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.productBatch.count({ where: { variantId } }),
    ]);

    return {
      data: batches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateBatch(batchId: string, userId: string, dto: UpdateBatchDto) {
    const batch = await this.prisma.productBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Lot non trouvé.');
    await this.verifyOwnership(batch.variantId, userId);

    const { quantity, expirationDate } = dto;
    const dataToUpdate: Prisma.ProductBatchUpdateInput = {
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
    };

    // Si la quantité change, nous devons créer un mouvement de stock pour la traçabilité
    if (quantity !== undefined && quantity !== batch.quantity) {
      const quantityChange = quantity - batch.quantity;

      return this.prisma.$transaction(async (tx) => {
        // Mettre à jour la quantité du lot
        const updatedBatch = await tx.productBatch.update({
          where: { id: batchId },
          data: { ...dataToUpdate, quantity },
        });

        // Mettre à jour la quantité totale sur la variante
        const updatedVariant = await tx.productVariant.update({
          where: { id: batch.variantId },
          data: { quantityInStock: { increment: quantityChange } },
        });

        // Créer un mouvement de stock de type AJUSTEMENT
        await tx.stockMovement.create({
          data: {
            variantId: batch.variantId,
            businessId: (await this.verifyOwnership(batch.variantId, userId))
              .businessId,
            performedById: userId,
            type: 'ADJUSTMENT',
            quantityChange,
            newQuantity: updatedVariant.quantityInStock,
            reason: `Mise à jour manuelle du lot #${batchId.substring(0, 8)}`,
          },
        });

        return updatedBatch;
      });
    } else {
      // Simple mise à jour sans changement de quantité
      return this.prisma.productBatch.update({
        where: { id: batchId },
        data: dataToUpdate,
      });
    }
  }

  async removeBatch(batchId: string, userId: string) {
    const batch = await this.prisma.productBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Lot non trouvé.');
    await this.verifyOwnership(batch.variantId, userId);

    // Si le lot contient encore du stock, il faut ajuster la variante
    if (batch.quantity > 0) {
      return this.prisma.$transaction(async (tx) => {
        const quantityChange = -batch.quantity;

        // Mettre à jour la quantité totale sur la variante
        const updatedVariant = await tx.productVariant.update({
          where: { id: batch.variantId },
          data: { quantityInStock: { decrement: batch.quantity } },
        });

        // Créer un mouvement de stock de type PERTE (LOSS)
        await tx.stockMovement.create({
          data: {
            variantId: batch.variantId,
            businessId: (await this.verifyOwnership(batch.variantId, userId))
              .businessId,
            performedById: userId,
            type: 'LOSS',
            quantityChange,
            newQuantity: updatedVariant.quantityInStock,
            reason: `Suppression du lot #${batchId.substring(0, 8)}`,
          },
        });

        // Supprimer le lot
        await tx.productBatch.delete({ where: { id: batchId } });
      });
    } else {
      // Le lot est vide, on peut le supprimer sans impacter le stock
      await this.prisma.productBatch.delete({ where: { id: batchId } });
    }

    return { message: 'Lot supprimé avec succès.' };
  }
}
