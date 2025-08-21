import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { UploaderModule } from 'src/uploader/uploader.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CurrenciesModule } from 'src/currencies/currencies.module';
import { CurrenciesService } from 'src/currencies/currencies.service';

@Module({
  imports: [PrismaModule, UploaderModule, CurrenciesModule],
  controllers: [ProductsController],
  providers: [ProductsService, CurrenciesService],
})
export class ProductsModule {}
