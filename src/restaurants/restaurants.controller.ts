// src/restaurants/restaurants.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { BusinessAdminGuard } from 'src/business/guard/business-admin.guard';
import { AddMenuItemDto } from './dto/add-menu-item.dto';

// Importer les DTOs de réponse
import {
  MenuResponseDto,
  RestaurantTableResponseDto,
} from './dto/restaurant-responses.dto';
import { User } from '@prisma/client';

@ApiTags('Restaurants')
@Controller('restaurants/:businessId') // Changement du préfixe du contrôleur pour plus de clarté
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  // --- GESTION DES TABLES ---
  @Post('tables')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Créer une nouvelle table (Admin/Owner requis)' })
  @ApiResponse({
    status: 201,
    type: RestaurantTableResponseDto,
    description: 'La table a été créée avec succès.',
  })
  createTable(
    @Param('businessId') businessId: string,
    @Request() req: { user: User },
    @Body() dto: CreateTableDto,
  ) {
    return this.restaurantsService.createTable(businessId, req.user.id, dto);
  }

  @Get('tables')
  @ApiOperation({ summary: "Lister toutes les tables d'un restaurant" })
  @ApiResponse({
    status: 200,
    type: [RestaurantTableResponseDto],
    description: 'Liste des tables du restaurant.',
  })
  findAllTables(@Param('businessId') businessId: string) {
    return this.restaurantsService.findAllTables(businessId);
  }

  @Patch('tables/:tableId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Mettre à jour une table (Admin/Owner requis)' })
  @ApiResponse({
    status: 200,
    type: RestaurantTableResponseDto,
    description: 'La table a été mise à jour.',
  })
  updateTable(
    @Param('tableId') tableId: string,
    @Request() req: { user: User },
    @Body() dto: UpdateTableDto,
  ) {
    return this.restaurantsService.updateTable(tableId, req.user.id, dto);
  }

  @Delete('tables/:tableId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Supprimer une table (Admin/Owner requis)' })
  @ApiResponse({
    status: 200,
    description: 'La table a été supprimée avec succès.',
  })
  removeTable(
    @Param('tableId') tableId: string,
    @Request() req: { user: User },
  ) {
    return this.restaurantsService.removeTable(tableId, req.user.id);
  }

  @Get('tables/available')
  @ApiOperation({
    summary:
      'Trouver les tables disponibles pour une date et une durée données',
  })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'Date et heure de début de la réservation (format ISO 8601)',
  })
  @ApiQuery({
    name: 'duration',
    type: Number,
    required: false,
    description: 'Durée en minutes (par défaut 120)',
  })
  @ApiResponse({
    status: 200,
    type: [RestaurantTableResponseDto],
    description: 'Liste des tables disponibles.',
  })
  findAvailableTables(
    @Param('businessId') businessId: string,
    @Query('date') date: string,
    @Query('duration') duration?: string,
  ) {
    return this.restaurantsService.findAvailableTables(
      businessId,
      date,
      duration ? parseInt(duration, 10) : undefined,
    );
  }

  // --- GESTION DES MENUS ---
  @Post('menus')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Créer un nouveau menu (Admin/Owner requis)' })
  @ApiResponse({
    status: 201,
    type: MenuResponseDto,
    description: 'Le menu a été créé avec succès.',
  })
  createMenu(
    @Param('businessId') businessId: string,
    @Request() req: { user: User },
    @Body() dto: CreateMenuDto,
  ) {
    return this.restaurantsService.createMenu(businessId, req.user.id, dto);
  }

  @Get('menus')
  @ApiOperation({ summary: "Lister tous les menus d'un restaurant" })
  @ApiResponse({
    status: 200,
    type: [MenuResponseDto],
    description: 'Liste des menus du restaurant.',
  })
  findAllMenus(@Param('businessId') businessId: string) {
    return this.restaurantsService.findAllMenus(businessId);
  }

  @Patch('menus/:menuId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({
    summary:
      "Mettre à jour les détails d'un menu (nom, prix, statut) (Admin/Owner requis)",
  })
  @ApiResponse({
    status: 200,
    type: MenuResponseDto,
    description: 'Le menu a été mis à jour.',
  })
  updateMenu(
    @Param('menuId') menuId: string,
    @Request() req: { user: User },
    @Body() dto: UpdateMenuDto,
  ) {
    return this.restaurantsService.updateMenu(menuId, req.user.id, dto);
  }

  @Delete('menus/:menuId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Supprimer un menu (Admin/Owner requis)' })
  @ApiResponse({
    status: 200,
    description: 'Le menu a été supprimé avec succès.',
  })
  removeMenu(@Param('menuId') menuId: string, @Request() req: { user: User }) {
    return this.restaurantsService.removeMenu(menuId, req.user.id);
  }

  // --- GESTION DES ÉLÉMENTS DE MENU ---
  @Post('menus/:menuId/items')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: 'Ajouter un plat à un menu (Admin/Owner requis)' })
  @ApiResponse({
    status: 201,
    /* type: MenuItemResponseDto */ description:
      "L'élément a été ajouté au menu.",
  })
  addMenuItem(
    @Param('menuId') menuId: string,
    @Request() req: { user: User },
    @Body() dto: AddMenuItemDto,
  ) {
    return this.restaurantsService.addMenuItem(menuId, req.user.id, dto);
  }

  @Patch('menus/:menuId/items/:itemId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({
    summary:
      "Mettre à jour la quantité d'un plat dans un menu (Admin/Owner requis)",
  })
  @ApiResponse({
    status: 200,
    /* type: MenuItemResponseDto */ description:
      "L'élément de menu a été mis à jour.",
  })
  updateMenuItem(
    @Param('itemId') itemId: string,
    @Request() req: { user: User },
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.restaurantsService.updateMenuItem(itemId, req.user.id, dto);
  }

  @Delete('menus/:menuId/items/:itemId')
  @UseGuards(BusinessAdminGuard) // ACTIVÉ
  @ApiOperation({ summary: "Retirer un plat d'un menu (Admin/Owner requis)" })
  @ApiResponse({
    status: 200,
    description: "L'élément de menu a été supprimé avec succès.",
  })
  removeMenuItem(
    @Param('itemId') itemId: string,
    @Request() req: { user: User },
  ) {
    return this.restaurantsService.removeMenuItem(itemId, req.user.id);
  }
}
