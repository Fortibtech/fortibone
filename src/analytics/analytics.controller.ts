// src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common'; // Importer Query
import { AnalyticsService } from './analytics.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'; // Importer ApiQuery
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { BusinessAdminGuard } from 'src/business/guards/business-admin.guard';
import { BusinessOverviewDto } from './dto/business-overview.dto';
import { QueryOverviewDto } from './dto/query-overview.dto'; // Importer le nouveau DTO
import { SalesPeriodUnit, QuerySalesDto } from './dto/query-sales.dto';
import { SalesDetailsDto } from './dto/sales-details.dto';
import { InventoryDetailsDto } from './dto/inventory-details.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { CustomerDetailsDto } from './dto/customer-details.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';

@ApiTags('Analytics')
@Controller('businesses/:businessId/analytics')
@UseGuards(JwtAuthGuard /*, BusinessAdminGuard*/)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      "Obtenir les statistiques générales (vue d'ensemble) d'une entreprise sur une période donnée",
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise. Les dates sont facultatives.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début de la période (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin de la période (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    type: BusinessOverviewDto,
    description: "Statistiques d'aperçu de l'entreprise.",
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise non trouvée.' })
  getBusinessOverview(
    @Param('businessId') businessId: string,
    @Request() req,
    @Query() queryDto: QueryOverviewDto, // Utiliser le DTO de requête
  ) {
    return this.analyticsService.getBusinessOverview(
      businessId,
      (req as { user: { id: string } }).user.id,
      queryDto,
    );
  }

  @Get('sales')
  @ApiOperation({
    summary:
      "Obtenir les statistiques de ventes détaillées d'une entreprise sur une période",
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise.",
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'unit',
    enum: SalesPeriodUnit,
    required: false,
    description: 'Unité de regroupement pour les ventes par période',
  })
  @ApiResponse({
    status: 200,
    type: SalesDetailsDto,
    description: 'Statistiques détaillées des ventes.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise non trouvée.' })
  getSalesDetails(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QuerySalesDto,
  ) {
    return this.analyticsService.getSalesDetails(
      businessId,
      req.user.id,
      queryDto,
    );
  }

  @Get('inventory')
  @ApiOperation({
    summary:
      "Obtenir les statistiques détaillées de l'inventaire d'une entreprise",
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise. Inclut la valeur de stock, les produits à stock bas et périmés, ainsi que les pertes agrégées.",
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: "Filtrer l'inventaire par ID de catégorie",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Terme de recherche pour les produits',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: "Date de début pour l'analyse des pertes (YYYY-MM-DD)",
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: "Date de fin pour l'analyse des pertes (YYYY-MM-DD)",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page pour les listes (produits bas stock, périmés)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limite par page pour les listes',
  })
  @ApiResponse({
    status: 200,
    type: InventoryDetailsDto,
    description: "Statistiques détaillées de l'inventaire.",
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise non trouvée.' })
  getInventoryDetails(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryInventoryDto,
  ) {
    return this.analyticsService.getInventoryDetails(
      businessId,
      req.user.id,
      queryDto,
    );
  }

  @Get('customers')
  @ApiOperation({
    summary:
      "Obtenir les statistiques détaillées sur les clients d'une entreprise (Top Clients)",
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise. Retourne les clients qui ont le plus dépensé ou passé le plus de commandes.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Rechercher par nom de client',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: CustomerDetailsDto,
    description: 'Statistiques détaillées sur les clients.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise non trouvée.' })
  getCustomerDetails(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryCustomersDto,
  ) {
    return this.analyticsService.getCustomerDetails(
      businessId,
      req.user.id,
      queryDto,
    );
  }
}
