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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

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

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'une commande par son ID" })
  findOne(@Param('id') id: string) {
    // TODO: Ajouter une logique de sécurité pour vérifier que l'utilisateur a le droit de voir cette commande
    return this.ordersService.findOne(id);
  }

  @Get('orders/my-orders')
  @ApiOperation({
    summary: "Lister toutes les commandes passées par l'utilisateur connecté",
  })
  findMyOrders(@Request() req, @Query() dto: QueryOrdersDto) {
    return this.ordersService.findForUser(req.user.id, dto);
  }

  @Get('businesses/:businessId/orders')
  @ApiOperation({
    summary:
      'Lister toutes les commandes reçues par une entreprise (Owner requis)',
  })
  findBusinessOrders(
    @Request() req,
    @Param('businessId') businessId: string,
    @Query() dto: QueryOrdersDto,
  ) {
    return this.ordersService.findForBusiness(businessId, req.user.id, dto);
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
