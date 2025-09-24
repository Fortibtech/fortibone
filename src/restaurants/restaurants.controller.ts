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

@ApiTags('Restaurants')
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post('tables')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Créer une nouvelle table (Admin/Owner requis)' })
  createTable(
    @Param('businessId') businessId: string,
    @Request() req,
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
    @Request() req,
    @Body() dto: UpdateTableDto,
  ) {
    return this.restaurantsService.updateTable(tableId, req.user.id, dto);
  }

  @Delete('tables/:tableId')
  //   @UseGuards(BusinessAdminGuard)
  @ApiOperation({ summary: 'Supprimer une table (Admin/Owner requis)' })
  removeTable(@Param('tableId') tableId: string, @Request() req) {
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
    @Request() req,
    @Body() dto: CreateMenuDto,
  ) {
    return this.restaurantsService.createMenu(businessId, req.user.id, dto);
  }

  @Get('menus')
  @ApiOperation({ summary: "Lister tous les menus d'un restaurant" })
  findAllMenus(@Param('businessId') businessId: string) {
    return this.restaurantsService.findAllMenus(businessId);
  }
}
