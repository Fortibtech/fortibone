// src/payments/providers/stripe.provider.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentIntentResult,
  WebhookResult,
  RefundResult,
} from '../interfaces/payment-provider.interface';
import {
  Order,
  PaymentMethodEnum,
  PaymentStatus,
  PrismaClient,
  User,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client'; // Pour utiliser Prisma.Decimal

@Injectable()
export class StripeProvider implements PaymentProvider {
  public readonly method: PaymentMethodEnum = PaymentMethodEnum.STRIPE;
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('STRIPE_API_KEY');
    this.webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!apiKey) {
      throw new InternalServerErrorException('Clé API Stripe non configurée.');
    }
    if (!this.webhookSecret) {
      // Ceci est moins critique pour le dev, mais indispensable en prod
      console.warn(
        'STRIPE_WEBHOOK_SECRET non configurée. Les webhooks Stripe ne seront pas validés.',
      );
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-06-20', // Utiliser la dernière version stable de l'API Stripe
    });
  }

  async createPaymentIntent(
    order: Order,
    user: User,
    tx: PrismaClient,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    if (!order.business || !order.business.currency) {
      // Vérification que les relations nécessaires sont incluses dans 'order'
      throw new InternalServerErrorException(
        "Informations sur la devise de l'entreprise manquantes pour le paiement.",
      );
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: order.totalAmount.mul(100).toNumber(), // Montant en centimes
        currency: order.business.currency.code.toLowerCase(), // Code ISO 4217 en minuscules
        metadata: {
          orderId: order.id,
          userId: user.id,
          // Ajouter d'autres metadata utiles pour le suivi Stripe
          ...metadata,
        },
        // Optionnel: client_name, client_email pour un meilleur suivi dans Stripe
        description: `Paiement pour la commande #${order.orderNumber} sur FortiBone`,
      });

      // Le statut initial de notre transaction est PENDING
      return {
        clientSecret: paymentIntent.client_secret,
        transactionId: paymentIntent.id,
        status: PaymentStatus.PENDING,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la création du PaymentIntent Stripe:',
        error,
      );
      throw new InternalServerErrorException(
        "Impossible de créer l'intention de paiement via Stripe.",
      );
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<WebhookResult> {
    let event: Stripe.Event;

    // --- 1. Vérification de la signature du webhook (CRITIQUE POUR LA SÉCURITÉ) ---
    if (this.webhookSecret && signature) {
      try {
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          this.webhookSecret,
        );
      } catch (err) {
        console.error(
          `Erreur de vérification de signature Stripe: ${err.message}`,
        );
        throw new BadRequestException(`Signature de webhook invalide.`);
      }
    } else if (!this.webhookSecret) {
      console.warn(
        'STRIPE_WEBHOOK_SECRET non configurée. Contournement de la vérification de signature du webhook. NE PAS FAIRE EN PRODUCTION.',
      );
      event = payload as Stripe.Event; // Contournement pour le dev si le secret est absent
    } else {
      throw new BadRequestException('Signature de webhook manquante.');
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    const transactionId = paymentIntent.id;

    if (!orderId || !transactionId) {
      throw new BadRequestException(
        'ID de commande ou ID de transaction manquant dans les métadonnées du PaymentIntent.',
      );
    }

    let status: PaymentStatus;
    switch (event.type) {
      case 'payment_intent.succeeded':
        status = PaymentStatus.SUCCESS;
        break;
      case 'payment_intent.payment_failed':
        status = PaymentStatus.FAILED;
        break;
      case 'charge.refunded': // Si un remboursement est initié directement depuis Stripe
      case 'payment_intent.canceled':
        status = PaymentStatus.REFUNDED;
        break;
      default:
        // Pour les événements que nous ne traitons pas directement mais qui pourraient arriver
        console.log(`Événement Stripe non géré: ${event.type}`);
        return {
          event: event.type,
          orderId,
          transactionId,
          status: PaymentStatus.PENDING, // Statut par défaut ou à déterminer
          metadata: paymentIntent.metadata,
        };
    }

    return {
      event: event.type,
      orderId,
      transactionId,
      status,
      amount: paymentIntent.amount_received
        ? paymentIntent.amount_received / 100
        : undefined,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    };
  }

  async refundPayment(
    order: Order,
    user: User,
    amount?: number,
    tx?: PrismaClient,
  ): Promise<RefundResult> {
    // Logique pour le remboursement Stripe
    if (!order.paymentIntentId) {
      throw new BadRequestException(
        "Cette commande n'a pas d'ID PaymentIntent Stripe.",
      );
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: order.paymentIntentId,
        amount: amount
          ? new Prisma.Decimal(amount).mul(100).toNumber()
          : undefined, // Montant en centimes
      });

      return {
        transactionId: refund.id,
        status:
          refund.status === 'succeeded'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PENDING_REFUND,
        amountRefunded: refund.amount / 100,
      };
    } catch (error) {
      console.error('Erreur lors du remboursement Stripe:', error);
      throw new InternalServerErrorException(
        'Impossible de traiter le remboursement via Stripe.',
      );
    }
  }

  async confirmManualPayment(
    order: Order,
    user: User,
    tx: PrismaClient,
    details?: any,
  ): Promise<PaymentTransaction> {
    // Cette méthode n'est pas pertinente pour Stripe, car Stripe est un paiement externe.
    // Elle serait vide ou lèverait une erreur si appelée par erreur.
    throw new BadRequestException(
      "Le paiement manuel n'est pas supporté par le fournisseur Stripe.",
    );
  }
}
