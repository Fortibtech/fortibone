// src/wallet/wallet.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Request,
  Body,
  Post,
} from '@nestjs/common';
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
import { PaymentIntentResponseDto } from 'src/payments/dto/payment-responses.dto';
import { DepositDto } from './dto/deposit.dto';

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

  @Post('deposit')
  @ApiOperation({ summary: 'Initier un dépôt pour recharger le portefeuille' })
  @ApiResponse({
    status: 201,
    type: PaymentIntentResponseDto,
    description:
      'Intention de paiement créée. Retourne un clientSecret/redirectUrl.',
  })
  @ApiResponse({
    status: 400,
    description: 'Montant ou méthode de paiement invalide.',
  })
  async initiateDeposit(
    @Request() req: { user: User },
    @Body() dto: DepositDto,
  ) {
    return this.walletService.initiateDeposit(req.user.id, dto);
  }
}
