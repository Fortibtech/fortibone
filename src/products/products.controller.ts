// src/products/products.controller.ts
import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Get,
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UploaderService } from 'src/uploader/uploader.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessType } from '@prisma/client';
import { ProductSortBy, QueryProductsDto } from './dto/query-products.dto';

@ApiTags('Products')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly uploaderService: UploaderService, // INJECTER
  ) {}

  @Get('products/search')
  @ApiOperation({
    summary: 'Recherche avancée et filtrage des produits',
    description:
      'Endpoint puissant pour rechercher des produits sur toute la plateforme avec une multitude de filtres combinables, la conversion de devises et la géolocalisation.',
  })
  // --- DOCUMENTATION DÉTAILLÉE DE CHAQUE PARAMÈTRE ---
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Terme de recherche textuelle.',
  })
  @ApiQuery({
    name: 'categoryId',
    type: String,
    required: false,
    description: 'ID de la catégorie pour filtrer.',
  })
  @ApiQuery({
    name: 'businessType',
    enum: BusinessType,
    required: false,
    description: "Filtrer par type d'entreprise.",
  })
  @ApiQuery({
    name: 'minPrice',
    type: Number,
    required: false,
    description: 'Prix minimum (dans la devise du client).',
  })
  @ApiQuery({
    name: 'maxPrice',
    type: Number,
    required: false,
    description: 'Prix maximum (dans la devise du client).',
  })
  @ApiQuery({
    name: 'currencyCode',
    type: String,
    required: false,
    description:
      'Code ISO de la devise du client (ex: USD, XAF) pour la conversion des prix.',
    example: 'EUR',
  })
  @ApiQuery({
    name: 'latitude',
    type: Number,
    required: false,
    description: 'Latitude du point central pour la recherche de proximité.',
  })
  @ApiQuery({
    name: 'longitude',
    type: Number,
    required: false,
    description: 'Longitude du point central pour la recherche de proximité.',
  })
  @ApiQuery({
    name: 'radius',
    type: Number,
    required: false,
    description: 'Rayon de recherche en kilomètres.',
  })
  @ApiQuery({
    name: 'sortBy',
    enum: ProductSortBy,
    required: false,
    description: 'Critère de tri des résultats.',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Numéro de la page de résultats.',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Nombre de résultats par page.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Retourne une liste paginée de produits correspondants aux critères.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Erreur dans les paramètres de la requête (ex: devise non supportée).',
  })
  search(@Query() queryDto: QueryProductsDto) {
    return this.productsService.search(queryDto);
  }

  @Post('businesses/:businessId/products')
  @ApiOperation({ summary: 'Créer un nouveau produit template (Owner requis)' })
  createProduct(
    @Request() req,
    @Param('businessId') businessId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.createProduct(
      businessId,
      req.user.id,
      createProductDto,
    );
  }

  @Post('products/:productId/variants')
  @ApiOperation({ summary: 'Ajouter une variante à un produit (Owner requis)' })
  createVariant(
    @Request() req,
    @Param('productId') productId: string,
    @Body() createVariantDto: CreateVariantDto,
  ) {
    return this.productsService.createVariant(
      productId,
      req.user.id,
      createVariantDto,
    );
  }
  // --- ENDPOINTS D'UPLOAD D'IMAGES ---
  @Post('products/:id/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: "Téléverser l'image principale d'un produit (Owner requis)",
  })
  @ApiConsumes('multipart/form-data') // ... (ApiBody schema)
  async uploadProductImage(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url } = await this.uploaderService.upload(file);
    return this.productsService.updateProductImage(id, req.user.id, url);
  }

  @Post('variants/:id/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: "Téléverser l'image d'une variante de produit (Owner requis)",
  })
  @ApiConsumes('multipart/form-data') // ... (ApiBody schema)
  async uploadVariantImage(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url } = await this.uploaderService.upload(file);
    return this.productsService.updateVariantImage(id, req.user.id, url);
  }

  @Get('products/:id')
  @ApiOperation({
    summary: "Obtenir les détails d'un produit et de ses variantes",
  })
  findProductById(@Param('id') id: string) {
    return this.productsService.findProductById(id);
  }
}
