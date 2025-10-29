// src/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { BusinessAdminGuard } from 'src/business/guards/business-admin.guard';

// Importez TOUS les DTOs de requête et de réponse
import { BusinessOverviewDto } from './dto/business-overview.dto';
import { QueryOverviewDto } from './dto/query-overview.dto';
import { SalesDetailsDto } from './dto/sales-details.dto';
import { QuerySalesDto, SalesPeriodUnit } from './dto/query-sales.dto';
import { InventoryDetailsDto } from './dto/inventory-details.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { CustomerDetailsDto } from './dto/customer-details.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { QueryRestaurantDto } from './dto/query-restaurant.dto';
import { MemberOverviewDto } from './dto/member-overview.dto';
import { QueryMemberOverviewDto } from './dto/query-member-overview.dto';
import { RestaurantDetailsDto } from './dto/restaurant-details.dto';
import { OrderStatus, OrderType } from '@prisma/client';
import { QueryOrdersDto } from 'src/orders/dto/query-orders.dto';
import { CustomerProfileDto } from './dto/customer-profile.dto';

// Pour les réponses paginées des listes (exemple pour les commandes du membre)
// Vous pourriez créer un DTO générique pour les réponses paginées si vous voulez uniformiser.
// Par exemple:
// class PaginatedOrderListResponse {
//   @ApiProperty({type: [Order], description: 'Liste des commandes'})
//   data: Order[]; // Importer le modèle Order
//   @ApiProperty({description: 'Nombre total d\'éléments'})
//   total: number;
//   // ... autres champs de pagination
// }

@ApiTags('Analytics')
@Controller('businesses/:businessId/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // --- STATISTIQUES GÉNÉRALES (OVERVIEW) ---
  @Get('overview')
  // @UseGuards(BusinessAdminGuard)
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
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryOverviewDto,
  ) {
    return this.analyticsService.getBusinessOverview(
      businessId,
      req.user.id,
      queryDto,
    );
  }

  // --- STATISTIQUES DE VENTES DÉTAILLÉES ---
  @Get('sales')
  // @UseGuards(BusinessAdminGuard)
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

  // --- STATISTIQUES D'INVENTAIRE ---
  @Get('inventory')
  // @UseGuards(BusinessAdminGuard)
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

  // --- STATISTIQUES CLIENT (TOP CLIENTS) ---
  @Get('customers')
  // @UseGuards(BusinessAdminGuard)
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

  // --- NOUVEL ENDPOINT POUR LA FICHE CLIENT DÉTAILLÉE ---
  @Get('customers/:customerId')
  @ApiOperation({
    summary:
      "Obtenir la fiche détaillée d'un client spécifique pour cette entreprise",
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise.",
  })
  @ApiResponse({
    status: 200,
    type: CustomerProfileDto,
    description: 'Fiche détaillée du client.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise ou client non trouvé.' })
  getCustomerProfile(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.analyticsService.getCustomerProfile(
      businessId,
      customerId,
      req.user.id,
    );
  }

  // --- STATISTIQUES DE RESTAURANT ---
  @Get('restaurant')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary: 'Obtenir les statistiques spécifiques aux restaurants',
    description:
      "Nécessite des privilèges de propriétaire ou d'administrateur de l'entreprise. Cet endpoint est uniquement pour les entreprises de type RESTAURATEUR.",
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
    description: 'Unité de regroupement pour les réservations par période',
  })
  @ApiResponse({
    status: 200,
    type: RestaurantDetailsDto,
    description: 'Statistiques détaillées pour un restaurant.',
  })
  @ApiResponse({
    status: 400,
    description: "L'entreprise n'est pas un restaurant.",
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise non trouvée.' })
  getRestaurantDetails(
    @Param('businessId') businessId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryRestaurantDto,
  ) {
    return this.analyticsService.getRestaurantDetails(
      businessId,
      req.user.id,
      queryDto,
    );
  }

  // --- STATISTIQUES DES MEMBRES (APERÇU) ---
  @Get('members/:memberId/overview')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary:
      "Obtenir les statistiques d'aperçu pour un membre spécifique de l'entreprise",
    description:
      "Nécessite que l'utilisateur connecté soit le membre lui-même, le propriétaire de l'entreprise, ou un administrateur de l'entreprise.",
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
    type: MemberOverviewDto,
    description: "Statistiques d'aperçu du membre.",
  })
  @ApiResponse({ status: 401, description: 'Non autorisé.' })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise ou membre non trouvé.' })
  getMemberOverview(
    @Param('businessId') businessId: string,
    @Param('memberId') memberId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryMemberOverviewDto,
  ) {
    return this.analyticsService.getMemberOverview(
      businessId,
      memberId,
      req.user.id,
      queryDto,
    );
  }

  // --- STATISTIQUES DÉTAILLÉES DES VENTES DU MEMBRE ---
  @Get('members/:memberId/sales')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary:
      'Obtenir les statistiques de ventes détaillées traitées par un membre',
    description:
      "Nécessite que l'utilisateur connecté soit le membre lui-même, le propriétaire de l'entreprise, ou un administrateur de l'entreprise.",
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
    description: 'Statistiques détaillées des ventes du membre.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise ou membre non trouvé.' })
  getMemberSalesDetails(
    @Param('businessId') businessId: string,
    @Param('memberId') memberId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QuerySalesDto,
  ) {
    return this.analyticsService.getMemberSalesDetails(
      businessId,
      memberId,
      req.user.id,
      queryDto,
    );
  }

  // --- MOUVEMENTS D'INVENTAIRE DU MEMBRE ---
  @Get('members/:memberId/inventory-movements')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary: "Obtenir les mouvements d'inventaire effectués par un membre",
    description:
      "Nécessite que l'utilisateur connecté soit le membre lui-même, le propriétaire de l'entreprise, ou un administrateur de l'entreprise.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par raison, nom de produit ou SKU',
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
    description:
      "Liste paginée des mouvements d'inventaire du membre." /* Ajoutez un DTO spécifique si la structure est différente du modèle StockMovement */,
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise ou membre non trouvé.' })
  getMemberInventoryMovements(
    @Param('businessId') businessId: string,
    @Param('memberId') memberId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryInventoryDto,
  ) {
    return this.analyticsService.getMemberInventoryMovements(
      businessId,
      memberId,
      req.user.id,
      queryDto,
    );
  }

  // --- COMMANDES TRAITÉES PAR LE MEMBRE ---
  @Get('members/:memberId/orders')
  // @UseGuards(BusinessAdminGuard)
  @ApiOperation({
    summary: 'Obtenir les commandes traitées par un membre',
    description:
      "Nécessite que l'utilisateur connecté soit le membre lui-même, le propriétaire de l'entreprise, ou un administrateur de l'entreprise.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par numéro de commande, notes, ou client',
  })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'type', required: false, enum: OrderType })
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
    description:
      'Liste paginée des commandes traitées par le membre.' /* Ajoutez un DTO spécifique si la structure est différente du modèle Order */,
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Entreprise ou membre non trouvé.' })
  getMemberOrders(
    @Param('businessId') businessId: string,
    @Param('memberId') memberId: string,
    @Request() req: { user: { id: string } },
    @Query() queryDto: QueryOrdersDto,
  ) {
    return this.analyticsService.getMemberOrders(
      businessId,
      memberId,
      req.user.id,
      queryDto,
    );
  }
}
