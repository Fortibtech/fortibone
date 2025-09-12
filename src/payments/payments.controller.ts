// src/payments/payments.controller.ts
import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PaymentMethodEnum } from '@prisma/client';
import { OrdersService } from 'src/orders/orders.service'; // Pour l'initiation du paiement

// DTO simple pour la méthode de paiement
class InitiatePaymentDto {
  @ApiProperty({
    enum: PaymentMethodEnum,
    description: 'La méthode de paiement à utiliser',
  })
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum;
}

// DTO pour le remboursement
class RefundOrderDto {
  @ApiPropertyOptional({
    description:
      'Montant à rembourser (laisser vide pour un remboursement complet)',
  })
  @IsNumber()
  @IsOptional()
  amount?: number;
}

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService, // Nous aurons besoin d'OrdersService pour initier le paiement
  ) {}

  @Post('orders/:orderId/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initier un paiement pour une commande' })
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Request() req,
    @Body() dto: InitiatePaymentDto,
  ) {
    // Appeler OrdersService pour la logique de statut et de paymentIntent
    return this.paymentsService.createPayment(orderId, req.user, dto.method);
  }

  @Post('payments/:provider/webhook')
  @ApiOperation({
    summary: 'Endpoint public pour les webhooks des fournisseurs de paiement',
  })
  // Ne pas utiliser JwtAuthGuard ici, les webhooks ont leur propre mécanisme de sécurité (signature)
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('stripe-signature') stripeSignature: string, // Exemple pour Stripe
    @Body() payload: any,
  ) {
    const providerEnum = PaymentMethodEnum[provider.toUpperCase()];
    if (!providerEnum) {
      throw new BadRequestException('Fournisseur de paiement non reconnu.');
    }
    return this.paymentsService.processWebhook(
      providerEnum,
      payload,
      stripeSignature,
    );
  }

  @Post('orders/:orderId/confirm-manual-payment')
  @UseGuards(JwtAuthGuard) // Doit être protégé par un Admin/OwnerGuard en production
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Confirmer manuellement un paiement pour une commande (Admin/Owner requis)',
  })
  async confirmManualPayment(
    @Param('orderId') orderId: string,
    @Request() req,
    @Body() details: any, // Détails du paiement manuel
  ) {
    return this.paymentsService.confirmManualPayment(
      orderId,
      req.user,
      details,
    );
  }

  @Post('orders/:orderId/refund')
  @UseGuards(JwtAuthGuard) // Doit être protégé par un Admin/OwnerGuard en production
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rembourser une commande (Admin/Owner requis)' })
  async refundOrder(
    @Param('orderId') orderId: string,
    @Request() req,
    @Body() dto: RefundOrderDto,
  ) {
    return this.paymentsService.refundOrder(orderId, req.user, dto.amount);
  }
}
