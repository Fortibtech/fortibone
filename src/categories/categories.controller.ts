// src/categories/categories.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateAttributeDto } from './dto/create-attribute.dto';

@ApiTags('Categories')
@Controller('categories')
// Pour l'instant, on protège avec JwtAuthGuard.
// Plus tard, on pourrait créer un AdminGuard plus spécifique.
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle catégorie (Admin requis)' })
  @ApiResponse({
    status: 201,
    description: 'La catégorie a été créée avec succès.',
  })
  @ApiResponse({
    status: 409,
    description: 'Une catégorie avec ce nom existe déjà.',
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister toutes les catégories et leurs attributs' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'une catégorie par son ID" })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post(':id/attributes')
  @ApiOperation({
    summary: 'Ajouter un attribut dynamique à une catégorie (Admin requis)',
  })
  @ApiResponse({
    status: 201,
    description: "L'attribut a été ajouté avec succès.",
  })
  createAttribute(
    @Param('id') id: string,
    @Body() createAttributeDto: CreateAttributeDto,
  ) {
    return this.categoriesService.createAttribute(id, createAttributeDto);
  }
}
