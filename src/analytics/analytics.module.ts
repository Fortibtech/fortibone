import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BusinessModule } from 'src/business/business.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, BusinessModule], // BusinessModule fournit BusinessAdminGuard

  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
