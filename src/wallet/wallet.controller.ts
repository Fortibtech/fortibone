// src/wallet/wallet.controller.ts
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { WalletResponseDto } from './dto/wallet-responses.dto';
import { User } from '@prisma/client';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({
    summary:
      "Obtenir les informations du portefeuille de l'utilisateur connecté",
    description:
      "Si le portefeuille n'existe pas, il sera créé automatiquement.",
  })
  @ApiResponse({
    status: 200,
    type: WalletResponseDto,
    description: "Détails du portefeuille de l'utilisateur.",
  })
  async getMyWallet(@Request() req: { user: User }) {
    return this.walletService.findOrCreateUserWallet(req.user.id);
  }

  // Les autres endpoints (deposit, withdrawal) viendront dans les phases suivantes
}
