// src/inventory/inventory.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Get,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AddBatchDto } from './dto/add-batch.dto';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('variants/:id/adjust')
  @ApiOperation({
    summary: "Ajuster manuellement le stock d'une variante (Owner requis)",
  })
  adjustStock(
    @Request() req,
    @Param('id') id: string,
    @Body() adjustStockDto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(id, req.user.id, adjustStockDto);
  }

  @Get('variants/:id/history')
  @ApiOperation({
    summary:
      "Obtenir l'historique complet des mouvements de stock pour une variante (Owner requis)",
  })
  getVariantHistory(@Request() req, @Param('id') id: string) {
    return this.inventoryService.getVariantHistory(id, req.user.id);
  }

  @Get('businesses/:id')
  @ApiOperation({
    summary: "Obtenir l'inventaire complet d'une entreprise (Owner requis)",
  })
  getBusinessInventory(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getBusinessInventory(id, req.user.id, {
      page,
      limit,
    });
  }

  @Post('variants/:id/batches')
  @ApiOperation({
    summary: 'Ajouter un nouveau lot de stock pour une variante (Owner requis)',
  })
  addBatch(
    @Request() req,
    @Param('id') id: string,
    @Body() addBatchDto: AddBatchDto,
  ) {
    return this.inventoryService.addBatch(id, req.user.id, addBatchDto);
  }

  @Get('businesses/:id/expiring-soon')
  @ApiOperation({
    summary:
      'Lister les produits proches de leur date de péremption (Owner requis)',
  })
  @ApiQuery({
    name: 'days',
    description: 'Nombre de jours pour la prévision (ex: 30)',
    type: Number,
  })
  findExpiringSoon(
    @Request() req,
    @Param('id') id: string,
    @Query('days') days: string,
  ) {
    const daysUntilExpiration = parseInt(days, 10) || 30; // 30 jours par défaut
    return this.inventoryService.findExpiringSoon(
      id,
      req.user.id,
      daysUntilExpiration,
    );
  }

  @Post('businesses/:id/record-expired-losses')
  @ApiOperation({
    summary:
      'Enregistrer automatiquement en perte tous les produits périmés (Owner requis)',
  })
  recordExpiredLosses(@Request() req, @Param('id') id: string) {
    return this.inventoryService.recordExpiredLosses(id, req.user.id);
  }
}
