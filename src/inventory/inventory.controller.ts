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
  Delete,
  Patch,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { QueryBatchesDto } from './dto/query-batches.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import {
  PaginatedBatchesResponseDto,
  BatchResponseDto,
  InventoryVariantResponseDto,
  StockMovementResponseDto,
} from './dto/inventory-responses.dto';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('variants/:id/adjust')
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiOperation({
    summary: "Ajuster manuellement le stock d'une variante (Owner requis)",
  })
  @ApiResponse({
    status: 200,
    type: InventoryVariantResponseDto,
    description: 'La variante a été mise à jour avec le nouveau stock.',
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
  @ApiResponse({
    status: 200,
    type: [StockMovementResponseDto],
    description: 'Historique des mouvements de stock.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
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
  @ApiResponse({
    status: 201,
    type: BatchResponseDto,
    description: 'Le lot a été créé avec succès.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
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
  @ApiResponse({
    status: 200,
    type: [BatchResponseDto],
    description: 'Liste des lots proches de leur date de péremption.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
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

  @Get('variants/:variantId/batches')
  @ApiOperation({
    summary: "Lister tous les lots d'une variante de produit (Owner requis)",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedBatchesResponseDto,
    description: 'Liste paginée des lots.',
  })
  findAllBatchesForVariant(
    @Request() req,
    @Param('variantId') variantId: string,
    @Query() queryDto: QueryBatchesDto,
  ) {
    return this.inventoryService.findAllBatchesForVariant(
      variantId,
      req.user.id,
      queryDto,
    );
  }
  @Patch('batches/:batchId')
  @ApiOperation({
    summary:
      "Mettre à jour les informations d'un lot spécifique (Owner requis)",
  })
  @ApiResponse({
    status: 200,
    type: BatchResponseDto,
    description: 'Le lot a été mis à jour.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Lot non trouvé.' })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Lot non trouvé.' })
  @ApiOperation({
    summary:
      "Mettre à jour les informations d'un lot spécifique (Owner requis)",
  })
  @ApiResponse({
    status: 200,
    type: BatchResponseDto,
    description: 'Le lot a été mis à jour.',
  })
  updateBatch(
    @Request() req,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
  ) {
    return this.inventoryService.updateBatch(batchId, req.user.id, dto);
  }

  @Delete('batches/:batchId')
  @ApiOperation({ summary: 'Supprimer un lot spécifique (Owner requis)' })
  @ApiResponse({
    status: 200,
    description: 'Le lot a été supprimé avec succès.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  @ApiResponse({ status: 404, description: 'Lot non trouvé.' })
  removeBatch(@Request() req, @Param('batchId') batchId: string) {
    return this.inventoryService.removeBatch(batchId, req.user.id);
  }
}
