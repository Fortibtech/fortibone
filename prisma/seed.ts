import {
  PrismaClient,
  ProfileType,
  BusinessType,
  MemberRole,
  DayOfWeek,
  OrderType,
  OrderStatus,
  SalesUnit,
  MovementType,
  Prisma,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import {
  hashPassword,
  generateRandomEmail,
  generateRandomPhoneNumber,
  getRandomElement,
  getRandomElements,
  getCurrencyByCode,
  getCategoryByName,
  getAttributeByNameAndCategory,
} from './utils/helpers';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // --- 0. NETTOYAGE (Optionnel mais recommandé pour repartir de zéro) ---
  console.log('Cleaning up existing data...');
  await prisma.order.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.businessReview.deleteMany();
  await prisma.favoriteProduct.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.productBatch.deleteMany();
  await prisma.variantAttributeValue.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.openingHour.deleteMany();
  await prisma.businessMember.deleteMany();
  await prisma.business.deleteMany();
  await prisma.categoryAttribute.deleteMany();
  await prisma.category.deleteMany();
  await prisma.currency.deleteMany();
  await prisma.user.deleteMany();
  console.log('Cleanup finished.');

  // --- 1. DEVISES ---
  console.log('Seeding currencies...');
  const eur = await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 1.0 },
  });
  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.92 },
  });
  const xaf = await prisma.currency.upsert({
    where: { code: 'XAF' },
    update: {},
    create: {
      code: 'XAF',
      name: 'CFA Franc',
      symbol: 'FCFA',
      exchangeRate: 0.0015,
    },
  });
  console.log('Currencies seeded.');

  // --- 2. CATÉGORIES ET ATTRIBUTS ---
  console.log('Seeding categories and attributes...');
  const clothingCategory = await prisma.category.upsert({
    where: { name: 'Vêtements' },
    update: {},
    create: {
      name: 'Vêtements',
      description: 'Articles textiles pour hommes, femmes et enfants.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Taille', categoryId: clothingCategory.id },
      { name: 'Couleur', categoryId: clothingCategory.id },
    ],
    skipDuplicates: true,
  });
  const clothingTailleAttr = await getAttributeByNameAndCategory(
    'Taille',
    clothingCategory.id,
  );
  const clothingCouleurAttr = await getAttributeByNameAndCategory(
    'Couleur',
    clothingCategory.id,
  );

  const electronicsCategory = await prisma.category.upsert({
    where: { name: 'Électronique' },
    update: {},
    create: {
      name: 'Électronique',
      description: 'Appareils électroniques, gadgets et accessoires.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [
      { name: 'Marque', categoryId: electronicsCategory.id },
      { name: 'Couleur', categoryId: electronicsCategory.id },
    ],
    skipDuplicates: true,
  });
  const electronicsMarqueAttr = await getAttributeByNameAndCategory(
    'Marque',
    electronicsCategory.id,
  );
  const electronicsCouleurAttr = await getAttributeByNameAndCategory(
    'Couleur',
    electronicsCategory.id,
  );

  const foodCategory = await prisma.category.upsert({
    where: { name: 'Produits Alimentaires' },
    update: {},
    create: {
      name: 'Produits Alimentaires',
      description: 'Produits frais, épicerie, boissons et plus encore.',
    },
  });
  await prisma.categoryAttribute.createMany({
    data: [{ name: 'Date de péremption', categoryId: foodCategory.id }],
    skipDuplicates: true,
  });
  const foodExpirationAttr = await getAttributeByNameAndCategory(
    'Date de péremption',
    foodCategory.id,
  );

  console.log('Categories and attributes seeded.');

  // --- 3. UTILISATEURS ---
  console.log('Seeding users...');
  const hashedPassword = await hashPassword('password123'); // Mot de passe commun pour tous les users

  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: hashedPassword,
      firstName: 'Alice',
      lastName: 'Client',
      profileType: ProfileType.PARTICULIER,
      isEmailVerified: true,
      phoneNumber: generateRandomPhoneNumber(),
      dateOfBirth: faker.date.birthdate(),
      country: faker.location.country(),
      city: faker.location.city(),
      gender: getRandomElement(['MALE', 'FEMALE']),
      // Belles images de profil
      profileImageUrl: faker.image.avatar(),
    },
  });

  const proOwnerUser = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      password: hashedPassword,
      firstName: 'Bob',
      lastName: 'Proprio',
      profileType: ProfileType.PRO,
      isEmailVerified: true,
      phoneNumber: generateRandomPhoneNumber(),
      dateOfBirth: faker.date.birthdate(),
      country: faker.location.country(),
      city: faker.location.city(),
      gender: getRandomElement(['MALE', 'FEMALE']),
      // Belles images de profil
      profileImageUrl: faker.image.avatar(),
    },
  });

  const proMemberUser = await prisma.user.create({
    data: {
      email: 'member@example.com',
      password: hashedPassword,
      firstName: 'Charlie',
      lastName: 'Membre',
      profileType: ProfileType.PRO,
      isEmailVerified: true,
      phoneNumber: generateRandomPhoneNumber(),
      dateOfBirth: faker.date.birthdate(),
      country: faker.location.country(),
      city: faker.location.city(),
      gender: getRandomElement(['MALE', 'FEMALE']),
      // Belles images de profil
      profileImageUrl: faker.image.avatar(),
    },
  });
  console.log('Users seeded.');
  // --- 4. ENTREPRISES ---
  console.log('Seeding businesses...');
  // Pour la localisation, on crée d'abord l'entreprise sans la localisation, puis on l'update avec une requête RAW
  const shop1 = await prisma.business.create({
    data: {
      ownerId: proOwnerUser.id,
      currencyId: eur.id,
      name: 'La Boutique de Bob',
      description: 'Vêtements et accessoires de qualité.',
      type: BusinessType.COMMERCANT,
      address: faker.location.streetAddress(true),
      phoneNumber: generateRandomPhoneNumber(),
      // --- IMAGES ENTREPRISE ---
      logoUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Logo+Bob', // Placeholder bleu
      coverImageUrl:
        'https://images.unsplash.com/photo-1542831371-d368e7399839?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHw0OXx8c2hvcHxlbnwwfHx8fDE2OTEzNjE3NDN8MA&ixlib=rb-4.0.3&q=80&w=1080', // Photo de boutique
      isVerified: true,
    },
  });
  await prisma.$executeRaw`
    UPDATE "Business"
    SET location = ST_SetSRID(ST_MakePoint(${2.3522}, ${48.8566}), 4326)
    WHERE id = ${shop1.id}
  `;

  const restaurant1 = await prisma.business.create({
    data: {
      ownerId: proOwnerUser.id,
      currencyId: usd.id,
      name: 'Le Goût du Monde',
      description: 'Restaurant international et branché.',
      type: BusinessType.RESTAURATEUR,
      address: faker.location.streetAddress(true),
      phoneNumber: generateRandomPhoneNumber(),
      // --- IMAGES RESTAURANT ---
      logoUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Le+Gout', // Placeholder rouge
      coverImageUrl:
        'https://images.unsplash.com/photo-1517248135467-4c7edabd34bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHwzMXx8cmVzdGF1cmFudHxlbnwwfHx8fDE2OTEzNjE2Mzh8MA&ixlib=rb-4.0.3&q=80&w=1080', // Photo de restaurant
      isVerified: true,
    },
  });
  await prisma.$executeRaw`
    UPDATE "Business"
    SET location = ST_SetSRID(ST_MakePoint(${-74.006}, ${40.7128}), 4326)
    WHERE id = ${restaurant1.id}
  `;

  const supplier1 = await prisma.business.create({
    data: {
      ownerId: proOwnerUser.id,
      currencyId: eur.id,
      name: 'Fournisseur Express',
      description: 'Fournisseur en gros de produits électroniques.',
      type: BusinessType.FOURNISSEUR,
      address: faker.location.streetAddress(true),
      phoneNumber: generateRandomPhoneNumber(),
      // --- IMAGES FOURNISSEUR ---
      logoUrl: 'https://via.placeholder.com/150/00FF00/000000?text=Fournisseur', // Placeholder vert
      coverImageUrl:
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHwyMHx8ZWxlY3Ryb25pY3N8ZW58MHx8fHwxNjkxMzYxOTUxfDA&ixlib=rb-4.0.3&q=80&w=1080', // Photo d'entrepôt/électronique
      isVerified: true,
    },
  });
  console.log('Businesses seeded.');

  // ... (sections 5 et 6 pour Business Members et Opening Hours - aucun changement ici) ...

  // --- 7. PRODUITS TEMPLATES ET VARIANTES ---
  console.log('Seeding products and variants...');

  // 7.1. Produit Vêtements
  const tShirt = await prisma.product.create({
    data: {
      businessId: shop1.id,
      categoryId: clothingCategory.id,
      name: 'T-shirt Casual',
      description: 'T-shirt en coton bio, confortable et stylé.',
      salesUnit: SalesUnit.UNIT,
      // --- IMAGE PRODUIT ---
      imageUrl:
        'https://images.unsplash.com/photo-1620799140408-edc6dcd7dce9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHw3fHx0LXNoaXJ0fGVufDB8fHx8MTY5MTM2Mjg1MXww&ixlib=rb-4.0.3&q=80&w=1080', // Image générique de T-shirt
    },
  });

  const tShirtMBlue = await prisma.productVariant.create({
    data: {
      productId: tShirt.id,
      price: 19.99,
      purchasePrice: 10.0,
      quantityInStock: 50,
      sku: 'TSHIRT-M-BLUE',
      // --- IMAGE VARIANTE ---
      imageUrl:
        'https://images.unsplash.com/photo-1571477174528-97a15104d48c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHwxNXx8Ymx1ZSUyMHQtc2hpcnR8ZW58MHx8fHwxNjkxMzYzMDA0fDA&ixlib=rb-4.0.3&q=80&w=1080', // T-shirt bleu
      batches: {
        create: [
          { quantity: 30, expirationDate: faker.date.future({ years: 2 }) },
          { quantity: 20, expirationDate: faker.date.future({ years: 1 }) },
        ],
      },
      attributeValues: {
        create: [
          { attributeId: clothingTailleAttr.id, value: 'M' },
          { attributeId: clothingCouleurAttr.id, value: 'Bleu' },
        ],
      },
    },
  });

  const tShirtLRed = await prisma.productVariant.create({
    data: {
      productId: tShirt.id,
      price: 21.99,
      purchasePrice: 11.0,
      quantityInStock: 30,
      sku: 'TSHIRT-L-RED',
      // --- IMAGE VARIANTE ---
      imageUrl:
        'https://images.unsplash.com/photo-1521572173163-f2777175949d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHw5fHxyZWQlMjB0LXNoaXJ0fGVufDB8fHx8MTY5MTM2MzAwOXww&ixlib=rb-4.0.3&q=80&w=1080', // T-shirt rouge
      batches: {
        create: [
          { quantity: 30, expirationDate: faker.date.future({ years: 1 }) },
        ],
      },
      attributeValues: {
        create: [
          { attributeId: clothingTailleAttr.id, value: 'L' },
          { attributeId: clothingCouleurAttr.id, value: 'Rouge' },
        ],
      },
    },
  });

  // 7.2. Produit Électronique (Fournisseur)
  const smartphone = await prisma.product.create({
    data: {
      businessId: supplier1.id,
      categoryId: electronicsCategory.id,
      name: 'Smartphone Pro X',
      description: 'Smartphone haut de gamme avec triple capteur photo.',
      salesUnit: SalesUnit.LOT, // Vendu en lots
      // --- IMAGE PRODUIT ---
      imageUrl:
        'https://images.unsplash.com/photo-1580910051074-3fa611fc91d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHw0OXx8c21hcnRwaG9uZXxlbnwwfHx8fDE2OTEzNjE5OTd8MA&ixlib=rb-4.0.3&q=80&w=1080', // Image générique de smartphone
    },
  });

  const smartphoneSilver = await prisma.productVariant.create({
    data: {
      productId: smartphone.id,
      price: 999.0,
      purchasePrice: 700.0,
      quantityInStock: 20,
      sku: 'SPROX-SILVER',
      itemsPerLot: 5, // 5 unités par lot
      lotPrice: 3500.0, // Prix de 5 unités
      // --- IMAGE VARIANTE ---
      imageUrl:
        'https://images.unsplash.com/photo-1592891393608-59af5d31481f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w0MDk3NDV8MHwxfHNlYXJjaHwxNXx8c2lsdmVyJTIwcGhvbmV8ZW58MHx8fHwxNjkxMzYyMjUzfDA&ixlib=rb-4.0.3&q=80&w=1080', // Smartphone argent
      batches: {
        create: [
          { quantity: 10, expirationDate: faker.date.future({ years: 3 }) },
          { quantity: 10, expirationDate: faker.date.future({ years: 2 }) },
        ],
      },
      attributeValues: {
        create: [
          { attributeId: electronicsMarqueAttr.id, value: 'TechCorp' },
          { attributeId: electronicsCouleurAttr.id, value: 'Argent' },
        ],
      },
    },
  });
  console.log('Products and variants seeded.');

  // --- 8. AVIS ---
  console.log('Seeding reviews...');
  await prisma.review.createMany({
    data: [
      {
        productId: tShirt.id,
        authorId: customerUser.id,
        rating: 5,
        comment: 'Excellent t-shirt, très confortable.',
      },
      {
        productId: smartphone.id,
        authorId: customerUser.id,
        rating: 4,
        comment: 'Très bon téléphone, un peu cher.',
      },
    ],
    skipDuplicates: true,
  });

  // Mettre à jour les agrégats de reviews sur les produits (fait manuellement pour le seed)
  await prisma.product.update({
    where: { id: tShirt.id },
    data: {
      averageRating: 5.0,
      reviewCount: 1,
    },
  });
  await prisma.product.update({
    where: { id: smartphone.id },
    data: {
      averageRating: 4.0,
      reviewCount: 1,
    },
  });
  console.log('Reviews seeded.');

  // --- 9. FAVORIS ---
  console.log('Seeding favorites...');
  await prisma.favoriteProduct.create({
    data: {
      userId: customerUser.id,
      productId: tShirt.id,
    },
  });
  console.log('Favorites seeded.');

  // --- 10. COMMANDES (SALES, PURCHASES, RESERVATIONS) ---
  console.log('Seeding orders...');

  // 10.1. Commande B2C (Vente)
  const saleOrder = await prisma.order.create({
    data: {
      orderNumber: `SALE-${faker.string.alphanumeric(8).toUpperCase()}`,
      type: OrderType.SALE,
      status: OrderStatus.COMPLETED,
      totalAmount: new Prisma.Decimal(19.99),
      notes: 'Livraison rapide souhaitée.',
      businessId: shop1.id,
      customerId: customerUser.id,
      lines: {
        create: [
          {
            variantId: tShirtMBlue.id,
            quantity: 1,
            price: new Prisma.Decimal(19.99),
          },
        ],
      },
      stockMovements: {
        create: [
          {
            variantId: tShirtMBlue.id,
            businessId: shop1.id,
            performedById: customerUser.id,
            type: MovementType.SALE,
            quantityChange: -1,
            newQuantity: tShirtMBlue.quantityInStock - 1,
            reason: `Vente - Commande #SALE-${faker.string.alphanumeric(8).toUpperCase()}`,
          },
        ],
      },
    },
  });

  // 10.2. Commande B2B (Achat / Réapprovisionnement)
  const purchaseOrder = await prisma.order.create({
    data: {
      orderNumber: `PURCH-${faker.string.alphanumeric(8).toUpperCase()}`,
      type: OrderType.PURCHASE,
      status: OrderStatus.DELIVERED,
      totalAmount: new Prisma.Decimal(3500.0),
      notes: 'Commande de réapprovisionnement mensuelle.',
      businessId: shop1.id, // L'entreprise qui ACHÈTE (le détaillant)
      customerId: proOwnerUser.id, // L'utilisateur qui a passé la commande (le propriétaire du détaillant)
      purchasingBusinessId: shop1.id, // L'entreprise qui achète
      employeeId: proOwnerUser.id,
      lines: {
        create: [
          {
            variantId: smartphoneSilver.id,
            quantity: 1,
            price: new Prisma.Decimal(3500.0),
          },
        ],
      },
    },
  });

  // 10.3. Réservation
  const reservationOrder = await prisma.order.create({
    data: {
      orderNumber: `RES-${faker.string.alphanumeric(8).toUpperCase()}`,
      type: OrderType.RESERVATION,
      status: OrderStatus.CONFIRMED,
      totalAmount: new Prisma.Decimal(0.0),
      notes: 'Table pour 4 personnes, vue sur la cuisine.',
      businessId: restaurant1.id,
      customerId: customerUser.id,
      tableNumber: 'Table 7',
      reservationDate: faker.date.future(),
      lines: {
        create: [],
      },
    },
  });

  console.log('Orders seeded.');

  console.log('Seeding finished.');
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
