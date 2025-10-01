// src/orders/orders.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, OrderType, User } from '@prisma/client';
import { UpdateOrderDto } from './dto/update-order.dto';

// Importer les DTOs de réponse
import {
  OrderResponseDto,
  PaginatedOrdersResponseDto,
} from './dto/order-responses.dto';

@ApiTags('Orders')
@Controller() // Préfixe appliqué au niveau des méthodes pour une meilleure organisation
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @ApiOperation({
    summary: 'Créer une nouvelle commande, un achat ou une réservation',
  })
  @ApiResponse({
    status: 201,
    type: OrderResponseDto,
    description: 'La commande a été créée avec succès.',
  })
  @ApiResponse({
    status: 400,
    description: 'Données de commande invalides ou stock insuffisant.',
  })
  create(
    @Request() req: { user: User },
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(createOrderDto, req.user);
  }

  @Get('orders/my-orders')
  @ApiOperation({
    summary:
      "Lister toutes les commandes passées par l'utilisateur connecté (avec filtres et pagination)",
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'type', required: false, enum: OrderType })
  @ApiQuery({
    name: 'variantId',
    required: false,
    type: String,
    description: 'ID de la variante de produit présente dans la commande',
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
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedOrdersResponseDto,
    description: "Liste paginée des commandes de l'utilisateur.",
  })
  findMyOrders(@Request() req: { user: User }, @Query() dto: QueryOrdersDto) {
    return this.ordersService.findForUser(req.user.id, dto);
  }

  @Get('businesses/:businessId/orders')
  @ApiOperation({
    summary:
      'Lister toutes les commandes reçues par une entreprise (Owner requis, avec filtres et pagination)',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'type', required: false, enum: OrderType })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'ID du client spécifique',
  })
  @ApiQuery({
    name: 'variantId',
    required: false,
    type: String,
    description: 'ID de la variante de produit présente dans la commande',
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
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedOrdersResponseDto,
    description: "Liste paginée des commandes de l'entreprise.",
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  findBusinessOrders(
    @Request() req: { user: User },
    @Param('businessId') businessId: string,
    @Query() dto: QueryOrdersDto,
  ) {
    return this.ordersService.findForBusiness(businessId, req.user.id, dto);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: "Obtenir les détails d'une commande par son ID" })
  @ApiResponse({
    status: 200,
    type: OrderResponseDto,
    description: 'Détails de la commande.',
  })
  @ApiResponse({ status: 404, description: 'Commande non trouvée.' })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  // TODO: La logique de sécurité est dans le service, mais pourrait être dans un guard
  findOne(@Request() req: { user: User }, @Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch('orders/:id')
  @ApiOperation({
    summary:
      "Mettre à jour les informations non-statutaires d'une commande (Owner requis)",
    description:
      "Permet de modifier les notes ou l'adresse de livraison si la commande n'est pas finalisée/expédiée.",
  })
  @ApiResponse({
    status: 200,
    type: OrderResponseDto,
    description: 'La commande a été mise à jour.',
  })
  @ApiResponse({
    status: 400,
    description: 'La commande ne peut pas être modifiée dans son état actuel.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  updateOrder(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(id, req.user.id, dto);
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary: "Mettre à jour le statut d'une commande (Owner requis)",
  })
  @ApiResponse({
    status: 200,
    type: OrderResponseDto,
    description: 'Le statut de la commande a été mis à jour.',
  })
  @ApiResponse({
    status: 400,
    description: 'Transition de statut non autorisée.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  updateStatus(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, req.user.id, dto);
  }
}
