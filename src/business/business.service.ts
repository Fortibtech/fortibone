// src/business/business.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { QueryBusinessDto } from './dto/query-business.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBusinessDto: CreateBusinessDto, ownerId: string) {
    const { latitude, longitude, ...rest } = createBusinessDto;

    const business = await this.prisma.business.create({
      data: {
        ...rest,
        owner: { connect: { id: ownerId } },
      },
    });

    // Mettre à jour la localisation avec une requête brute si les coordonnées sont fournies
    if (latitude && longitude) {
      await this.prisma.$executeRaw`
        UPDATE "Business"
        SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
        WHERE id = ${business.id}
      `;
    }

    return this.prisma.business.findUnique({ where: { id: business.id } });
  }

  async findAll(queryDto: QueryBusinessDto) {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      latitude,
      longitude,
      radius = 10,
    } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.BusinessWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    // Si des coordonnées sont fournies, effectuer une recherche de proximité
    if (latitude !== undefined && longitude !== undefined) {
      const radiusInMeters = radius * 1000; // Convertir km en mètres

      // Cette requête brute récupère les IDs des entreprises dans le rayon spécifié
      const businessesInRadius: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM "Business"
        WHERE ST_DWithin(
          location,
          ST_MakePoint(${longitude}, ${latitude})::geography,
          ${radiusInMeters}
        )
      `;

      const ids = businessesInRadius.map((b) => b.id);

      if (ids.length === 0) {
        return { data: [], total: 0, page, limit }; // Aucune entreprise trouvée, retourner un résultat vide
      }

      // Ajouter la condition sur les IDs au filtre principal
      where.id = { in: ids };
    }

    const [businesses, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.business.count({ where }),
    ]);

    return {
      data: businesses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!business) {
      throw new NotFoundException(
        `L'entreprise avec l'ID ${id} n'a pas été trouvée.`,
      );
    }
    return business;
  }

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
    userId: string,
  ) {
    // Vérification d'autorisation : seul le propriétaire peut modifier
    await this.checkOwnership(id, userId); // Réutiliser la vérification

    return this.prisma.business.update({
      where: { id },
      data: updateBusinessDto,
    });
  }

  async remove(id: string, userId: string) {
    await this.checkOwnership(id, userId); // Réutiliser la vérification

    await this.prisma.business.delete({ where: { id } });
    return {
      message: `L'entreprise avec l'ID ${id} a été supprimée avec succès.`,
    };
  }

  // NOUVELLE MÉTHODE POUR VÉRIFIER LA PROPRIÉTÉ
  async checkOwnership(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true }, // On ne récupère que ce dont on a besoin
    });

    if (!business) {
      throw new NotFoundException(
        `L'entreprise avec l'ID ${businessId} n'a pas été trouvée.`,
      );
    }

    if (business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à effectuer cette action sur cette entreprise.",
      );
    }
  }
  async updateBusinessImage(
    businessId: string,
    userId: string,
    imageUrls: { logoUrl?: string; coverImageUrl?: string },
  ) {
    const business = await this.findOne(businessId);

    // Vérification d'autorisation cruciale
    if (business.ownerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier cette entreprise.",
      );
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: imageUrls,
    });
  }
}
