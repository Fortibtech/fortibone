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
  PaymentTransaction,
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
    this.webhookSecret = this.configService.getOrThrow<string>(
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

    this.stripe = new Stripe(apiKey);
  }

  async handleWebhook(
    rawPayload: any,
    headers: Record<string, string>,
  ): Promise<WebhookResult> {
    // <--- MODIFIÉ
    let event: Stripe.Event;
    const signature = headers['stripe-signature']; // Récupérer la signature spécifique à Stripe

    // --- 1. Vérification de la signature du webhook (CRITIQUE POUR LA SÉCURITÉ) ---
    if (!signature) {
      throw new BadRequestException('Signature de webhook Stripe manquante.');
    }
    if (!this.webhookSecret) {
      console.warn(
        'STRIPE_WEBHOOK_SECRET non configurée. Contournement de la vérification de signature du webhook. NE PAS FAIRE EN PRODUCTION.',
      );
      event = JSON.parse(rawPayload) as Stripe.Event; // Si pas de secret, on assume le payload est bon (dev seulement)
    } else {
      try {
        // Le payload pour constructEvent doit être la chaîne brute, pas l'objet JS parsé
        event = this.stripe.webhooks.constructEvent(
          rawPayload,
          signature,
          this.webhookSecret,
        );
      } catch (err) {
        console.error(
          `Erreur de vérification de signature Stripe: ${err.message}`,
        );
        throw new BadRequestException(`Signature de webhook Stripe invalide.`);
      }
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata?.orderId;
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
          provider: this.method,
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
      provider: this.method,
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

  confirmManualPayment(
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

  // --- MÉTHODE createPaymentIntent REFACTORISÉE ---
  async createPaymentIntent(
    // On reçoit un objet simplifié au lieu d'une Order complète
    paymentData: {
      totalAmount: Prisma.Decimal;
      business: { currency: { code: string } };
    },
    user: User,
    tx: PrismaClient,
    metadata: { paymentMethodId?: string; [key: string]: any },
  ): Promise<PaymentIntentResult> {
    const { totalAmount, business } = paymentData;
    const { paymentMethodId, ...restMetadata } = metadata;

    try {
      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: totalAmount.mul(100).toNumber(), // Montant en centimes
        currency: business.currency.code.toLowerCase(),
        metadata: {
          userId: user.id,
          ...restMetadata,
        },
        description: `Paiement sur FortiBone`,
      };

      // Si un paymentMethodId est fourni, tenter la confirmation automatique
      if (paymentMethodId) {
        intentParams.payment_method = paymentMethodId;
        intentParams.customer = await this.findOrCreateStripeCustomer(
          user.email,
        );
        intentParams.confirm = true;
        intentParams.off_session = true; // Pour les paiements initiés par le serveur
      }

      const paymentIntent =
        await this.stripe.paymentIntents.create(intentParams);

      let status: PaymentStatus;
      let clientSecret: string | null;
      switch (paymentIntent.status) {
        case 'requires_action': // Ex: 3D Secure, redirection nécessaire
        case 'requires_confirmation':
        case 'requires_payment_method':
          status = PaymentStatus.PENDING;
          clientSecret = paymentIntent.client_secret; // Le frontend utilisera ce secret pour gérer l'action
          break;
        case 'succeeded':
          status = PaymentStatus.SUCCESS;
          clientSecret = paymentIntent.client_secret;
          break;
        case 'canceled':
        case 'requires_capture': // Si vous avez un flux de capture séparé
          status = PaymentStatus.FAILED; // Ou un autre statut approprié
          clientSecret = paymentIntent.client_secret;
          break;
        default:
          status = PaymentStatus.PENDING;
          clientSecret = paymentIntent.client_secret;
          break;
      }

      return {
        clientSecret, // Toujours retourné, au cas où une authentification 3D Secure est requise
        transactionId: paymentIntent.id,
        status,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la création/confirmation du PaymentIntent Stripe:',
        error,
      );
      throw new InternalServerErrorException(
        `Impossible de créer/confirmer l'intention de paiement via Stripe.`,
      );
    }
  }

  // Helper pour trouver ou créer un client Stripe (bonne pratique pour sauvegarder les cartes)
  private async findOrCreateStripeCustomer(email: string): Promise<string> {
    const customers = await this.stripe.customers.list({
      email: email,
      limit: 1,
    });
    if (customers.data.length > 0) {
      return customers.data[0].id;
    }
    const newCustomer = await this.stripe.customers.create({ email });
    return newCustomer.id;
  }
}
