// src/payments/payments.controller.ts
import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Request,
  Headers,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentMethodEnum, PaymentStatus, User } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmManualPaymentDto } from './dto/confirm-manual-payment.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';

// Importer les DTOs de réponse
import {
  PaymentIntentResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/payment-responses.dto';
import { OrderResponseDto } from 'src/orders/dto/order-responses.dto';

@ApiTags('Payments')
@Controller() // Préfixe appliqué au niveau des méthodes
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:orderId/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initier un paiement pour une commande',
    description: 'Crée une intention de paiement avec le fournisseur spécifié.',
  })
  @ApiResponse({
    status: 201,
    type: PaymentIntentResponseDto,
    description: 'Intention de paiement créée avec succès.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Commande non trouvée ou non éligible au paiement, ou méthode non configurée.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Request() req: { user: User },
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.createPayment(
      orderId,
      req.user,
      dto.method,
      dto.metadata,
    );
  }

  @Post('payments/webhook/:provider')
  @ApiOperation({
    summary: 'Endpoint public pour les webhooks des fournisseurs de paiement',
    description:
      'Ce endpoint reçoit les notifications de succès/échec de paiement des fournisseurs. Il NE DOIT PAS être protégé par un JwtAuthGuard.',
  })
  @ApiResponse({ status: 200, description: 'Webhook traité avec succès.' })
  @ApiResponse({
    status: 400,
    description: 'Signature invalide ou payload de webhook malformé.',
  })
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    const providerEnum = PaymentMethodEnum[provider.toUpperCase()];
    if (!providerEnum) {
      throw new BadRequestException('Fournisseur de paiement non reconnu.');
    }
    // const signature =  headers['stripe-signature'] || headers['x-mvola-signature']; // Adapter selon les headers réels
    return this.paymentsService.processWebhook(
      providerEnum,
      payload,
      headers,
    );
  }

  @Post('orders/:orderId/confirm-manual-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirmer manuellement un paiement pour une commande',
    description:
      "Confirme qu'un paiement hors ligne a été reçu. Nécessite des privilèges Admin ou Propriétaire.",
  })
  @ApiResponse({
    status: 200,
    type: OrderResponseDto,
    description:
      'Paiement manuel confirmé avec succès et commande mise à jour.',
  })
  @ApiResponse({
    status: 400,
    description: 'Commande non éligible à la confirmation manuelle.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  async confirmManualPayment(
    @Param('orderId') orderId: string,
    @Request() req: { user: User },
    @Body() dto: ConfirmManualPaymentDto,
  ) {
    return this.paymentsService.confirmManualPayment(orderId, req.user, dto);
  }

  @Post('orders/:orderId/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rembourser une commande',
    description:
      'Initie un remboursement pour une commande. Nécessite des privilèges Admin ou Propriétaire.',
  })
  @ApiResponse({
    status: 200,
    type: OrderResponseDto,
    description: 'Remboursement initié avec succès et commande mise à jour.',
  })
  @ApiResponse({
    status: 400,
    description: 'Commande non éligible au remboursement.',
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  async refundOrder(
    @Param('orderId') orderId: string,
    @Request() req: { user: User },
    @Body() dto: RefundOrderDto,
  ) {
    return this.paymentsService.refundOrder(orderId, req.user, dto.amount);
  }

  @Get('payments/my-transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Lister l'historique de toutes les transactions de paiement de l'utilisateur connecté",
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'method', required: false, enum: PaymentMethodEnum })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'orderId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedTransactionsResponseDto,
    description: "Liste paginée des transactions de l'utilisateur.",
  })
  async findMyTransactions(
    @Request() req: { user: User },
    @Query() dto: QueryTransactionsDto,
  ) {
    return this.paymentsService.findTransactionsForUser(req.user.id, dto);
  }

  @Get('businesses/:businessId/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Lister l'historique des transactions de paiement pour une entreprise (Owner requis)",
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'method', required: false, enum: PaymentMethodEnum })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'orderId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'minAmount', required: false, type: Number })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    type: PaginatedTransactionsResponseDto,
    description: "Liste paginée des transactions de l'entreprise.",
  })
  @ApiResponse({ status: 403, description: 'Accès interdit.' })
  async findBusinessTransactions(
    @Param('businessId') businessId: string,
    @Request() req: { user: User },
    @Query() dto: QueryTransactionsDto,
  ) {
    return this.paymentsService.findTransactionsForBusiness(
      businessId,
      req.user.id,
      dto,
    );
  }
}
