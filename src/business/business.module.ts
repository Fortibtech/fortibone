// src/business/business.module.ts
import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessAdminGuard } from './guard/business-admin.guard';
import { CurrenciesModule } from 'src/currencies/currencies.module';
import { UploaderModule } from 'src/uploader/uploader.module';
import { CurrenciesService } from 'src/currencies/currencies.service';

@Module({
  imports: [PrismaModule, UploaderModule, CurrenciesModule],
  controllers: [BusinessController],
  providers: [BusinessService, BusinessAdminGuard, CurrenciesService],
})
export class BusinessModule {}
