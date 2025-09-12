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
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, OrderType } from '@prisma/client';
import { UpdateOrderDto } from './dto/update-order.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Créer une nouvelle commande, un achat ou une réservation',
  })
  create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
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
  findMyOrders(@Request() req, @Query() dto: QueryOrdersDto) {
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
  findBusinessOrders(
    @Request() req,
    @Param('businessId') businessId: string,
    @Query() dto: QueryOrdersDto,
  ) {
    return this.ordersService.findForBusiness(businessId, req.user.id, dto);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: "Obtenir les détails d'une commande par son ID" })
  // TODO: Ajouter une logique de sécurité pour vérifier que l'utilisateur a le droit de voir cette commande (client, owner, member)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch('orders/:id')
  @ApiOperation({
    summary:
      "Mettre à jour les informations non-statutaires d'une commande (Owner requis)",
    description:
      "Permet de modifier les notes ou l'adresse de livraison si la commande n'est pas finalisée/expédiée.",
  })
  updateOrder(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(id, req.user.id, dto);
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary: "Mettre à jour le statut d'une commande (Owner requis)",
  })
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, req.user.id, dto);
  }
}
