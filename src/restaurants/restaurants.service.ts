import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { BusinessType } from '@prisma/client';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyRestaurantOwnership(businessId: string, userId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Entreprise non trouvée.');
    if (business.type !== BusinessType.RESTAURATEUR)
      throw new BadRequestException(
        'Cette fonctionnalité est réservée aux restaurants.',
      );
    if (business.ownerId !== userId)
      throw new ForbiddenException('Action non autorisée.'); // Simplifié, BusinessAdminGuard gère les admins
    return business;
  }

  // --- Gestion des Tables ---
  async createTable(businessId: string, userId: string, dto: CreateTableDto) {
    await this.verifyRestaurantOwnership(businessId, userId);
    return this.prisma.restaurantTable.create({ data: { ...dto, businessId } });
  }

  async findAllTables(businessId: string) {
    return this.prisma.restaurantTable.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async updateTable(tableId: string, userId: string, dto: UpdateTableDto) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Table non trouvée.');
    await this.verifyRestaurantOwnership(table.businessId, userId);
    return this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: dto,
    });
  }

  async removeTable(tableId: string, userId: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Table non trouvée.');
    await this.verifyRestaurantOwnership(table.businessId, userId);
    await this.prisma.restaurantTable.delete({ where: { id: tableId } });
    return { message: 'Table supprimée avec succès.' };
  }

  // --- Gestion des Menus ---
  async createMenu(businessId: string, userId: string, dto: CreateMenuDto) {
    await this.verifyRestaurantOwnership(businessId, userId);
    const { items, ...menuData } = dto;

    return this.prisma.menu.create({
      data: {
        ...menuData,
        businessId,
        menuItems: {
          create: items.map((item) => ({
            quantity: item.quantity,
            variantId: item.variantId,
          })),
        },
      },
      include: { menuItems: true },
    });
  }

  async findAllMenus(businessId: string) {
    return this.prisma.menu.findMany({
      where: { businessId },
      include: {
        menuItems: {
          include: {
            variant: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // --- Logique de Disponibilité des Tables ---
  async findAvailableTables(
    businessId: string,
    date: string,
    durationInMinutes: number = 120,
  ) {
    const startTime = new Date(date);
    const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);

    const conflictingReservations = await this.prisma.order.findMany({
      where: {
        businessId,
        type: 'RESERVATION',
        status: { notIn: ['CANCELLED', 'REJECTED'] },
        reservationDate: {
          // Un créneau est en conflit si:
          // 1. Il commence pendant le créneau demandé.
          // 2. Il se termine pendant le créneau demandé.
          // 3. Il englobe le créneau demandé.
          lt: endTime,
          gt: new Date(startTime.getTime() - 2 * 60 * 60000), // Marge de 2h avant pour le calcul de fin
        },
      },
      select: { tableId: true },
    });

    const bookedTableIds = conflictingReservations
      .filter((r) => r.tableId)
      .map((r) => r.tableId).filter(Boolean) as string[];

    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        businessId,
        isAvailable: true,
        id: { notIn: bookedTableIds },
      },
      orderBy: { name: 'asc' },
    });
    return tables || [];
  }
}
