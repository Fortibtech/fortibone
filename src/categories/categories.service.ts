// src/categories/categories.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Vérifier si une catégorie avec le même nom existe déjà
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: createCategoryDto.name },
    });
    if (existingCategory) {
      throw new ConflictException(
        `Une catégorie nommée "${createCategoryDto.name}" existe déjà.`,
      );
    }
    return this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  findAll() {
    return this.prisma.category.findMany({
      include: {
        attributes: true, // Inclure les attributs associés à chaque catégorie
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        attributes: true,
      },
    });
    if (!category) {
      throw new NotFoundException(
        `La catégorie avec l'ID ${id} n'a pas été trouvée.`,
      );
    }
    return category;
  }

  async createAttribute(
    categoryId: string,
    createAttributeDto: CreateAttributeDto,
  ) {
    // S'assurer que la catégorie parente existe
    await this.findOne(categoryId);

    // Vérifier si un attribut avec le même nom existe déjà pour cette catégorie
    const existingAttribute = await this.prisma.categoryAttribute.findUnique({
      where: {
        name_categoryId: {
          name: createAttributeDto.name,
          categoryId: categoryId,
        },
      },
    });
    if (existingAttribute) {
      throw new ConflictException(
        `L'attribut "${createAttributeDto.name}" existe déjà pour cette catégorie.`,
      );
    }

    return this.prisma.categoryAttribute.create({
      data: {
        name: createAttributeDto.name,
        categoryId: categoryId,
      },
    });
  }
}
