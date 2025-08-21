import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Configuration globale des pipes de validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime automatiquement les propriétés non-définies dans les DTOs
      forbidNonWhitelisted: true, // Leve une erreur si des propriétés non-définies sont envoyées
      transform: true, // Transforme les payloads pour correspondre aux types des DTOs
    }),
  );

  // Configuration de la documentation Swagger
  const config = new DocumentBuilder()
    .setTitle('FortibOne API')
    .setDescription(
      'Documentation de l"API pour la plateforme commerciale FortiBone',
    )
    .setVersion('1.0')
    .addBearerAuth() // Pour la protection par token JWT
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // L'UI sera disponible sur /api-docs

   // Servir les fichiers statiques depuis le dossier 'uploads'
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Assurer un arrêt propre de l'application (utile pour Prisma)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
