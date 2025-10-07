// src/payments/interfaces/payment-provider.interface.ts
import {
  Order,
  PaymentTransaction,
  PaymentMethodEnum,
  PaymentStatus,
  User,
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export interface PaymentIntentResult {
  clientSecret?: string | null; // Pour les paiements via formulaire Stripe
  redirectUrl?: string; // Pour les paiements avec redirection (ex: Mvola ou certaines banques)
  transactionId: string; // L'ID du paiement côté fournisseur (ex: pi_xxx pour Stripe)
  status: PaymentStatus; // Statut initial de la transaction
  // Toute autre info nécessaire au frontend pour afficher le paiement
}

export interface WebhookResult {
  event: string; // Type d'événement (ex: payment_intent.succeeded)
  orderId: string;
  transactionId: string; // L'ID du paiement côté fournisseur
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  metadata?: any;
  provider: PaymentMethodEnum;
}

export interface RefundResult {
  transactionId: string; // ID du remboursement
  status: PaymentStatus;
  amountRefunded: number;
}

// Le contrat que chaque fournisseur de paiement devra implémenter
export abstract class PaymentProvider {
  abstract readonly method: PaymentMethodEnum; // La méthode que ce provider gère (STRIPE, MVOLA, MANUAL)

  abstract createPaymentIntent(
    order: Order,
    user: User, // L'utilisateur qui initie le paiement
    prisma: PrismaClient, // Pour les interactions BDD dans la transaction
    metadata?: any,
  ): Promise<PaymentIntentResult>;

  abstract handleWebhook(
    payload: any,
    headers?: Record<string, any>,
    prisma?: PrismaClient, // Peut être nécessaire pour les webhooks
  ): Promise<WebhookResult>;

  // Pour les paiements manuels, un "intent" n'est pas créé par un tiers, mais confirmé en interne
  abstract confirmManualPayment(
    order: Order,
    user: User, // L'employé qui confirme le paiement
    prisma: PrismaClient,
    details?: any,
  ): Promise<PaymentTransaction>;

  abstract refundPayment(
    order: Order,
    user: User, // L'utilisateur qui demande/effectue le remboursement (ex: admin)
    amount?: number, // Montant à rembourser (partiel)
    prisma?: PrismaClient,
  ): Promise<RefundResult>;
}
