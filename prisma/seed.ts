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
