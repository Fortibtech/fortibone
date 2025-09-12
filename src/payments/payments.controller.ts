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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Assurez-vous du bon chemin
import { PaymentMethodEnum, User } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmManualPaymentDto } from './dto/confirm-manual-payment.dto';
import { RefundOrderDto } from './dto/refund-order.dto';

@ApiTags('Payments')
@Controller() // Le contrôleur est maintenant préfixé par ses méthodes pour plus de flexibilité
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    // Nous n'avons plus besoin d'OrdersService directement ici car PaymentsService gère l'orchestration
  ) {}

  @Post('orders/:orderId/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initier un paiement pour une commande',
    description:
      "Crée une intention de paiement avec le fournisseur spécifié. Pour Stripe, si un `paymentMethodId` est fourni dans `metadata`, la transaction tentera d'être confirmée automatiquement.",
  })
  @ApiResponse({
    status: 200,
    description: 'Intention de paiement créée avec succès.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Commande non trouvée ou non éligible au paiement, ou méthode non configurée.',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé.' })
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

  @Post('payments/:provider/webhook')
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
  // Ne pas utiliser JwtAuthGuard ici, les webhooks ont leur propre mécanisme de sécurité (signature)
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>, // Collecter TOUS les headers

    @Body() payload?: any,
  ) {
    const providerEnum = PaymentMethodEnum[provider.toUpperCase()];
    if (!providerEnum) {
      throw new BadRequestException('Fournisseur de paiement non reconnu.');
    }
    // Le body du webhook Stripe arrive souvent comme une chaîne de caractères brute.
    // Il faut le passer tel quel au service pour que Stripe.webhooks.constructEvent puisse le parser.
    // Pour Mvola, le payload est généralement déjà un objet JSON.
    const rawBody =
      providerEnum === PaymentMethodEnum.STRIPE
        ? JSON.stringify(payload)
        : payload;

    // Le service se chargera de récupérer la bonne signature dans l'objet 'headers'
    // et de vérifier la validité du payload.
    return this.paymentsService.processWebhook(providerEnum, rawBody, headers);
  }

  @Post('orders/:orderId/confirm-manual-payment')
  @UseGuards(JwtAuthGuard) // L'utilisateur doit être connecté pour effectuer cette action
  @ApiBearerAuth()
  // Utilise BusinessAdminGuard pour s'assurer que l'utilisateur est propriétaire/admin de l'entreprise associée à la commande
  // Note: BusinessAdminGuard a besoin de l'ID de l'entreprise dans params.id, donc nous allons l'adapter ou créer un OrderAdminGuard.
  // Pour l'instant, on se base sur la vérification dans le service.
  // @UseGuards(BusinessAdminGuard) // Potentiellement un guard plus générique 'OrderAdminGuard' ou la logique directement dans le service.
  @ApiOperation({
    summary: 'Confirmer manuellement un paiement pour une commande',
    description:
      "Confirme qu'un paiement hors ligne (espèces, virement) a été reçu. Nécessite des privilèges Admin ou Propriétaire de l'entreprise.",
  })
  @ApiResponse({
    status: 200,
    description: 'Paiement manuel confirmé avec succès.',
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
  @UseGuards(JwtAuthGuard) // L'utilisateur doit être connecté pour demander un remboursement
  @ApiBearerAuth()
  // @UseGuards(BusinessAdminGuard) // Comme ci-dessus, nécessite un guard adapté
  @ApiOperation({
    summary: 'Rembourser une commande',
    description:
      "Initie un remboursement pour une commande. Nécessite des privilèges Admin ou Propriétaire de l'entreprise.",
  })
  @ApiResponse({
    status: 200,
    description: 'Remboursement initié avec succès.',
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
}
