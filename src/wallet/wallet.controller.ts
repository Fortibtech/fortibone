// src/wallet/wallet.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Request,
  Body,
  Post,
  Query,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  WalletResponseDto,
  WalletTransactionResponseDto,
} from './dto/wallet-responses.dto';
import {
  User,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import {
  PaginatedTransactionsResponseDto,
  PaymentIntentResponseDto,
} from 'src/payments/dto/payment-responses.dto';
import { DepositDto } from './dto/deposit.dto';
import { QueryWalletTransactionsDto } from './dto/query-wallet-transactions.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { TransferDto } from './dto/transfer.dto';

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

  @Post('withdraw')
  @ApiOperation({ summary: 'Demander un retrait des fonds du portefeuille' })
  @ApiResponse({
    status: 201,
    type: WalletTransactionResponseDto,
    description: 'Demande de retrait créée et en attente de validation.',
  })
  @ApiResponse({ status: 400, description: 'Solde insuffisant.' })
  async requestWithdrawal(
    @Request() req: { user: User },
    @Body() dto: WithdrawalDto,
  ) {
    return this.walletService.requestWithdrawal(req.user.id, dto);
  }

  @Get('transactions')
  @ApiOperation({
    summary:
      "Obtenir l'historique des transactions du portefeuille de l'utilisateur connecté",
    description:
      'Retourne une liste paginée et filtrable de toutes les transactions du portefeuille.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Rechercher un terme dans la description de la transaction',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: WalletTransactionType,
    description: 'Filtrer par type de transaction',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WalletTransactionStatus,
    description: 'Filtrer par statut de transaction',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (YYYY-MM-DD)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedTransactionsResponseDto,
    description: "Liste paginée de l'historique des transactions.",
  })
  async findMyTransactions(
    @Request() req: { user: User },
    @Query() dto: QueryWalletTransactionsDto,
  ) {
    return this.walletService.findUserTransactions(req.user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({
    summary: "Transférer de l'argent à un autre utilisateur FortiBone",
    description:
      "Le montant est débité du portefeuille de l'expéditeur et crédité sur celui du destinataire, avec gestion de la conversion de devise.",
  })
  @ApiResponse({
    status: 201,
    type: WalletTransactionResponseDto,
    description:
      "Transfert effectué avec succès. Retourne la transaction de débit de l'expéditeur.",
  })
  @ApiResponse({
    status: 400,
    description: 'Solde insuffisant ou destinataire invalide.',
  })
  @ApiResponse({ status: 404, description: 'Destinataire non trouvé.' })
  async transfer(@Request() req: { user: User }, @Body() dto: TransferDto) {
    return this.walletService.transfer(req.user.id, dto);
  }
}
