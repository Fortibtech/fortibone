// prisma/utils/helpers.ts
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { Currency, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function generateRandomEmail(): string {
  return faker.internet.email().toLowerCase();
}

export function generateRandomPhoneNumber(): string {
  return faker.phone.number();
}

export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = array.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Fonction pour récupérer une devise par son code
export async function getCurrencyByCode(code: string): Promise<Currency> {
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) {
    throw new Error(
      `Currency with code ${code} not found. Please seed currencies first.`,
    );
  }
  return currency;
}

// Fonction pour récupérer une catégorie par son nom
export async function getCategoryByName(name: string) {
  const category = await prisma.category.findUnique({ where: { name } });
  if (!category) {
    throw new Error(
      `Category with name "${name}" not found. Please seed categories first.`,
    );
  }
  return category;
}

// Fonction pour récupérer un attribut par son nom et ID de catégorie
export async function getAttributeByNameAndCategory(
  name: string,
  categoryId: string,
) {
  const attribute = await prisma.categoryAttribute.findUnique({
    where: { name_categoryId: { name, categoryId } },
  });
  if (!attribute) {
    throw new Error(
      `Attribute "${name}" for category "${categoryId}" not found.`,
    );
  }
  return attribute;
}
