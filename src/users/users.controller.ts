// src/users/users.controller.ts
import {
  Controller,
  Get,
  Body,
  Put,
  Param,
  Delete,
  Request,
  UseGuards,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploaderService } from 'src/uploader/uploader.service';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard) // Protège toutes les routes de ce contrôleur
@ApiBearerAuth() // Indique à Swagger que ces routes nécessitent un token
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploaderService: UploaderService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: "Récupérer le profil de l'utilisateur actuellement connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Retourne les informations du profil.',
  })
  getProfile(@Request() req) {
    // req.user est déjà peuplé par JwtStrategy et ne contient pas le mot de passe
    return req.user;
  }

  @Put('me')
  @ApiOperation({
    summary: "Mettre à jour le profil de l'utilisateur actuellement connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Le profil a été mis à jour avec succès.',
  })
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Delete('me')
  @ApiOperation({
    summary: "Supprimer le compte de l'utilisateur actuellement connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Le compte a été supprimé avec succès.',
  })
  deleteProfile(@Request() req) {
    return this.usersService.remove(req.user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Récupérer le profil public d'un utilisateur par son ID",
  })
  @ApiResponse({
    status: 200,
    description: "Retourne le profil public de l'utilisateur.",
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file')) // 'file' est le nom du champ dans la requête form-data
  @ApiOperation({ summary: 'Téléverser ou mettre à jour la photo de profil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // 1. Téléverser le fichier en utilisant le service générique
    const { url } = await this.uploaderService.upload(file);

    // 2. Mettre à jour le profil de l'utilisateur avec la nouvelle URL
    const updatedUser = await this.usersService.update(req.user.id, {
      profileImageUrl: url,
    });

    return updatedUser;
  }
}
