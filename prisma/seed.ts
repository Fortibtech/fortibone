// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  // La devise de BASE de notre système est l'Euro (EUR)
  // Tous les taux de change sont relatifs à l'EUR.
  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 1.0 },
  });

  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.92 }, // 1 USD = 0.92 EUR (exemple)
  });

  await prisma.currency.upsert({
    where: { code: 'XAF' },
    update: {},
    create: {
      code: 'XAF',
      name: 'CFA Franc',
      symbol: 'FCFA',
      exchangeRate: 0.0015,
    }, // 1 XAF = 0.0015 EUR (exemple)
  });

  // --- SEEDING DES CATÉGORIES ET ATTRIBUTS ---
  console.log('Seeding categories and attributes...');

  // 1. Catégorie "Vêtements"
  const clothing = await prisma.category.upsert({
    where: { name: 'Vêtements' },
    update: {},
    create: {
      name: 'Vêtements',
      description: 'Articles textiles pour hommes, femmes et enfants.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Taille', categoryId: clothing.id },
      { name: 'Couleur', categoryId: clothing.id },
      { name: 'Matière', categoryId: clothing.id },
    ],
    skipDuplicates: true, // Ne pas créer si un attribut existe déjà
  });

  // 2. Catégorie "Électronique"
  const electronics = await prisma.category.upsert({
    where: { name: 'Électronique' },
    update: {},
    create: {
      name: 'Électronique',
      description: 'Appareils électroniques, gadgets et accessoires.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Marque', categoryId: electronics.id },
      { name: 'Couleur', categoryId: electronics.id }, // "Couleur" peut exister dans plusieurs catégories
      { name: 'Garantie', categoryId: electronics.id },
    ],
    skipDuplicates: true,
  });

  // 3. Catégorie "Produits Alimentaires"
  const food = await prisma.category.upsert({
    where: { name: 'Produits Alimentaires' },
    update: {},
    create: {
      name: 'Produits Alimentaires',
      description: 'Produits frais, épicerie, boissons et plus encore.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Date de péremption', categoryId: food.id },
      { name: 'Poids (g)', categoryId: food.id },
      { name: 'Allergènes', categoryId: food.id },
    ],
    skipDuplicates: true,
  });

  // 4. Catégorie "Livres"
  const books = await prisma.category.upsert({
    where: { name: 'Livres' },
    update: {},
    create: {
      name: 'Livres',
      description: "Livres de tous genres, neufs et d'occasion.",
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Auteur', categoryId: books.id },
      { name: 'ISBN', categoryId: books.id },
      { name: 'Langue', categoryId: books.id },
    ],
    skipDuplicates: true,
  });

  console.log('Categories and attributes seeded.');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
