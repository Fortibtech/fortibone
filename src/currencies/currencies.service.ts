// src/currencies/currencies.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.currency.findMany();
  }

  // Méthode interne pour trouver une devise par son code
  findByCode(code: string) {
    return this.prisma.currency.findUnique({ where: { code } });
  }
}
