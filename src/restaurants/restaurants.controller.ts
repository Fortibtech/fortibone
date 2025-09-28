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

@ApiTags('Restaurants')
@Controller('restaurants/:businessId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post('tables')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Créer une nouvelle table (Admin/Owner requis)' })
  createTable(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateTableDto,
  ) {
    return this.restaurantsService.createTable(businessId, req.user.id, dto);
  }

  @Get('tables')
  @ApiOperation({ summary: "Lister toutes les tables d'un restaurant" })
  findAllTables(@Param('businessId') businessId: string) {
    return this.restaurantsService.findAllTables(businessId);
  }

  @Patch('tables/:tableId')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Mettre à jour une table (Admin/Owner requis)' })
  updateTable(
    @Param('tableId') tableId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateTableDto,
  ) {
    return this.restaurantsService.updateTable(tableId, req.user.id, dto);
  }

  @Delete('tables/:tableId')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Supprimer une table (Admin/Owner requis)' })
  removeTable(
    @Param('tableId') tableId: string,
    @Request() req: { user: { id: string } },
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

  @Post('menus')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Créer un nouveau menu (Admin/Owner requis)' })
  createMenu(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CreateMenuDto,
  ) {
    return this.restaurantsService.createMenu(businessId, req.user.id, dto);
  }

  @Get('menus')
  @ApiOperation({ summary: "Lister tous les menus d'un restaurant" })
  findAllMenus(@Param('businessId') businessId: string) {
    return this.restaurantsService.findAllMenus(businessId);
  }

  // --- NOUVEL ENDPOINT POUR METTRE À JOUR UN MENU ---
  @Patch('menus/:menuId')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Mettre à jour un menu (Admin/Owner requis)' })
  updateMenu(
    @Param('menuId') menuId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateMenuDto,
  ) {
    return this.restaurantsService.updateMenu(menuId, req.user.id, dto);
  }

  // --- NOUVEL ENDPOINT POUR SUPPRIMER UN MENU ---
  @Delete('menus/:menuId')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Supprimer un menu (Admin/Owner requis)' })
  removeMenu(
    @Param('menuId') menuId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.restaurantsService.removeMenu(menuId, req.user.id);
  }

  // --- ENDPOINTS DÉDIÉS AUX ÉLÉMENTS DE MENU (MENU ITEMS) ---
  @Post('menus/:menuId/items')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Ajouter un plat à un menu (Admin/Owner requis)' })
  addMenuItem(
    @Param('menuId') menuId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AddMenuItemDto,
  ) {
    return this.restaurantsService.addMenuItem(menuId, req.user.id, dto);
  }

  @Patch('menus/:menuId/items/:itemId')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary:
      "Mettre à jour la quantité d'un plat dans un menu (Admin/Owner requis)",
  })
  updateMenuItem(
    @Param('itemId') itemId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.restaurantsService.updateMenuItem(itemId, req.user.id, dto);
  }

  @Delete('menus/:menuId/items/:itemId')
  @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: "Retirer un plat d'un menu (Admin/Owner requis)" })
  removeMenuItem(
    @Param('itemId') itemId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.restaurantsService.removeMenuItem(itemId, req.user.id);
  }
}
