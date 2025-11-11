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
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { WalletModule } from './wallet/wallet.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { PdfModule } from './pdf/pdf.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Rend les variables .env disponibles globalement
      envFilePath: '.env',
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
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    AnalyticsModule,
    RestaurantsModule,
    WalletModule,
    InvoicingModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
