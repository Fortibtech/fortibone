import { Module } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BusinessModule } from 'src/business/business.module';

@Module({
  imports: [PrismaModule, BusinessModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
})
export class RestaurantsModule {}
