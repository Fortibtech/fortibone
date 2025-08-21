import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploaderModule } from 'src/uploader/uploader.module';

@Module({
  imports: [PrismaModule, UploaderModule], // AJOUTER UploaderModule
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
