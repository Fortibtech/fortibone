// src/business/business.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { QueryBusinessDto } from './dto/query-business.dto';
import { Business, MemberRole, Prisma, User } from '@prisma/client';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CurrenciesService } from 'src/currencies/currencies.service';
import { CreateBusinessReviewDto } from './dto/create-business-review.dto';
import { SetOpeningHoursDto } from './dto/set-opening-hours.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currenciesService: CurrenciesService, // INJECTER
    private readonly mailService: MailService, // INJECTER
  ) {}

  async create(createBusinessDto: CreateBusinessDto, ownerId: string) {
    const { currencyId, latitude, longitude, ...rest } = createBusinessDto;

    let finalCurrencyId = currencyId;

    // Si aucun ID de devise n'est fourni, utiliser l'EUR par défaut
    if (!finalCurrencyId) {
      const defaultCurrency = await this.currenciesService.findByCode('EUR');
      if (!defaultCurrency) {
        throw new Error(
          "La devise par défaut (EUR) n'est pas configurée dans le système.",
        );
      }
      finalCurrencyId = defaultCurrency.id;
    }

    // Vérifier que la devise existe avant de créer l'entreprise
    const currency = await this.prisma.currency.findUnique({
      where: { id: finalCurrencyId },
    });
    if (!currency) {
      throw new BadRequestException(
        `La devise spécifiée (${finalCurrencyId}) n'existe pas.`,
      );
    }

    const businessData = {
      ...rest,
      owner: { connect: { id: ownerId } },
      currency: { connect: { id: finalCurrencyId } },
    };

    const business = await this.prisma.business.create({
      data: businessData,
    });

    // Mettre à jour la localisation avec une requête brute si les coordonnées sont fournies
    if (latitude && longitude) {
      await this.prisma.$executeRaw`
        UPDATE "Business"
        SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
        WHERE id = ${business.id}
      `;
    }

    return this.prisma.business.findUnique({
      where: { id: business.id },
      include: { currency: true }, // Inclure la devise dans la réponse
    });
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
        openingHours: true, // Inclure les horaires
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

  // --- GESTION DES MEMBRES ---

  // L'ancienne méthode 'addMember' devient 'inviteMember'
  async inviteMember(businessId: string, inviter: User, dto: AddMemberDto) {
    const { email, role } = dto;
    const business = await this.findOne(businessId);

    // 1. Vérifier si un utilisateur avec cet email existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // L'utilisateur existe, on l'ajoute directement comme membre
      return this.addMember(business.id, { email: existingUser.email, role });
    } else {
      // L'utilisateur n'existe pas, on crée une invitation formelle
      return this.createNewInvitation(business, inviter, email, role);
    }
  }

  async addMember(businessId: string, addMemberDto: AddMemberDto) {
    const { email, role } = addMemberDto;

    const [userToAdd, business] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.business.findUnique({ where: { id: businessId } }),
    ]);

    if (!userToAdd) {
      throw new NotFoundException(
        `Aucun utilisateur trouvé avec l'email ${email}.`,
      );
    }

    if (userToAdd.id === business?.ownerId) {
      throw new BadRequestException(
        'Le propriétaire ne peut pas être ajouté comme membre.',
      );
    }

    const existingMembership = await this.prisma.businessMember.findUnique({
      where: { userId_businessId: { userId: userToAdd.id, businessId } },
    });

    if (existingMembership) {
      throw new ConflictException(
        'Cet utilisateur est déjà membre de cette entreprise.',
      );
    }

    return this.prisma.businessMember.create({
      data: {
        businessId,
        userId: userToAdd.id,
        role,
      },
    });
  }

  private async createNewInvitation(
    business: Business,
    inviter: User,
    email: string,
    role: MemberRole,
  ) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expiration dans 7 jours
    const token = crypto.randomUUID().toString();

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        token,
        role,
        expiresAt,
        businessId: business.id,
        invitedById: inviter.id,
      },
    });

    await this.mailService.sendInvitationEmail(
      email,
      token,
      business.name,
      `${inviter.firstName} ${inviter.lastName || ''}`,
    );

    return { message: `Une invitation a été envoyée à ${email}.` };
  }

  async findAllMembers(businessId: string) {
    return this.prisma.businessMember.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImageUrl: true,
          },
        },
      },
    });
  }

  async updateMemberRole(
    businessId: string,
    memberId: string,
    updateMemberDto: UpdateMemberDto,
  ) {
    return this.prisma.businessMember.update({
      where: { userId_businessId: { userId: memberId, businessId } },
      data: { role: updateMemberDto.role },
    });
  }

  async removeMember(businessId: string, memberId: string) {
    const business = await this.findOne(businessId);
    if (memberId === business.ownerId) {
      throw new ForbiddenException(
        "Le propriétaire de l'entreprise ne peut pas être retiré.",
      );
    }

    await this.prisma.businessMember.delete({
      where: { userId_businessId: { userId: memberId, businessId } },
    });
    return { message: "Le membre a été retiré de l'entreprise avec succès." };
  }

  // --- GESTION DES HORAIRES ---
  async setOpeningHours(businessId: string, dto: SetOpeningHoursDto) {
    const { hours } = dto;
    // Transaction : supprimer les anciens horaires et créer les nouveaux d'un seul coup
    return this.prisma.$transaction(async (tx) => {
      await tx.openingHour.deleteMany({ where: { businessId } });
      if (hours && hours.length > 0) {
        await tx.openingHour.createMany({
          data: hours.map((hour) => ({ ...hour, businessId })),
        });
      }
      return tx.business.findUnique({
        where: { id: businessId },
        include: { openingHours: true },
      });
    });
  }

  // --- GESTION DES AVIS ---
  async createReview(
    businessId: string,
    authorId: string,
    dto: CreateBusinessReviewDto,
  ) {
    // Vérifier qu'un avis n'existe pas déjà pour cet utilisateur et cette entreprise
    const existingReview = await this.prisma.businessReview.findUnique({
      where: { businessId_authorId: { businessId, authorId } },
    });
    if (existingReview) {
      throw new ConflictException(
        'Vous avez déjà laissé un avis pour cette entreprise.',
      );
    }

    // Transaction : créer l'avis ET mettre à jour les agrégats sur l'entreprise
    return this.prisma.$transaction(async (tx) => {
      await tx.businessReview.create({
        data: { ...dto, businessId, authorId },
      });

      // Recalculer les agrégats
      const aggregates = await tx.businessReview.aggregate({
        where: { businessId },
        _avg: { rating: true },
        _count: { id: true },
      });

      const avgRating = aggregates._avg.rating || 0;
      const reviewCount = aggregates._count.id || 0;

      // Mettre à jour l'entreprise avec les nouvelles valeurs
      return tx.business.update({
        where: { id: businessId },
        data: {
          averageRating: parseFloat(avgRating.toFixed(2)), // Arrondir à 2 décimales
          reviewCount: reviewCount,
        },
      });
    });
  }

  async findAllReviews(businessId: string, { page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.businessReview.findMany({
        where: { businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, firstName: true, profileImageUrl: true },
          },
        },
      }),
      this.prisma.businessReview.count({ where: { businessId } }),
    ]);

    return {
      data: reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
