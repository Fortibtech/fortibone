import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { UploaderModule } from './uploader/uploader.module';
import { BusinessModule } from './business/business.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Rend les variables .env disponibles globalement
    }),
    PrismaModule,
    AuthModule,
    MailModule,
    UsersModule,
    UploaderModule,
    BusinessModule,
    CurrenciesModule,
    CategoriesModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
