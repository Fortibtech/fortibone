// src/business/business.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  Query,
  UploadedFile,
  UseInterceptors,
  Put,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BusinessType, ProfileType } from '@prisma/client';
import { QueryBusinessDto } from './dto/query-business.dto';
import { UploaderService } from 'src/uploader/uploader.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { BusinessAdminGuard } from './guard/business-admin.guard';
import { CreateBusinessReviewDto } from './dto/create-business-review.dto';
import { SetOpeningHoursDto } from './dto/set-opening-hours.dto';

@ApiTags('Businesses')
@Controller('businesses')
@UseGuards(JwtAuthGuard) // Protège toutes les routes du contrôleur
@ApiBearerAuth()
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly uploaderService: UploaderService, // << INJECTER
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Créer une nouvelle entreprise (pour les utilisateurs PRO)',
  })
  @ApiResponse({
    status: 201,
    description: "L'entreprise a été créée avec succès.",
  })
  @ApiResponse({
    status: 403,
    description: 'Seuls les utilisateurs PRO peuvent créer une entreprise.',
  })
  create(@Request() req, @Body() createBusinessDto: CreateBusinessDto) {
    const user = req.user;

    // Vérification de rôle : seul un utilisateur PRO peut créer une entreprise
    if (user.profileType !== ProfileType.PRO) {
      throw new ForbiddenException(
        'Seuls les utilisateurs avec un profil PRO peuvent créer une entreprise.',
      );
    }

    return this.businessService.create(createBusinessDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister, filtrer et paginer toutes les entreprises',
  })
  // Documentation Swagger pour chaque paramètre de requête
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: BusinessType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({
    name: 'radius',
    required: false,
    type: Number,
    description: 'Rayon en kilomètres',
  })
  findAll(@Query() queryDto: QueryBusinessDto) {
    return this.businessService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'une entreprise par son ID" })
  findOne(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une entreprise' })
  @ApiResponse({ status: 403, description: 'Action non autorisée.' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.businessService.update(id, updateBusinessDto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une entreprise' })
  @ApiResponse({ status: 403, description: 'Action non autorisée.' })
  remove(@Request() req, @Param('id') id: string) {
    return this.businessService.remove(id, req.user.id);
  }

  // --- NOUVEL ENDPOINT POUR LE LOGO ---
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: "Téléverser ou mettre à jour le logo d'une entreprise",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadLogo(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url } = await this.uploaderService.upload(file);
    return this.businessService.updateBusinessImage(id, req.user.id, {
      logoUrl: url,
    });
  }

  // --- NOUVEL ENDPOINT POUR L'IMAGE DE COUVERTURE ---
  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      "Téléverser ou mettre à jour l'image de couverture d'une entreprise",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadCoverImage(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url } = await this.uploaderService.upload(file);
    return this.businessService.updateBusinessImage(id, req.user.id, {
      coverImageUrl: url,
    });
  }

  // --- ENDPOINTS POUR LA GESTION DES MEMBRES ---

  @Post(':id/members')
  @UseGuards(JwtAuthGuard, BusinessAdminGuard)
  @ApiOperation({
    summary: 'Inviter ou ajouter un membre (Admin/Owner requis)',
  })
  addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.businessService.inviteMember(id, req.user, dto);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard) // Potentiellement, tout membre peut voir l'équipe
  @ApiOperation({ summary: "Lister les membres d'une entreprise" })
  findAllMembers(@Param('id') id: string) {
    return this.businessService.findAllMembers(id);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, BusinessAdminGuard)
  @ApiOperation({
    summary: "Mettre à jour le rôle d'un membre (Admin/Owner requis)",
  })
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.businessService.updateMemberRole(id, memberId, updateMemberDto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, BusinessAdminGuard)
  @ApiOperation({
    summary: "Retirer un membre d'une entreprise (Admin/Owner requis)",
  })
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.businessService.removeMember(id, memberId);
  }

  // --- HORAIRES D'OUVERTURE ---
  @Put(':id/opening-hours')
  @UseGuards(JwtAuthGuard, BusinessAdminGuard)
  @ApiOperation({
    summary: "Définir les horaires d'ouverture (Admin/Owner requis)",
  })
  setOpeningHours(@Param('id') id: string, @Body() dto: SetOpeningHoursDto) {
    return this.businessService.setOpeningHours(id, dto);
  }

  // --- AVIS ET NOTATION ---
  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard) // Tout utilisateur connecté peut laisser un avis
  @ApiOperation({ summary: 'Laisser un avis sur une entreprise' })
  createReview(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateBusinessReviewDto,
  ) {
    return this.businessService.createReview(id, req.user.id, dto);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: "Lister les avis d'une entreprise avec pagination" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllReviews(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.businessService.findAllReviews(id, { page, limit });
  }
}
