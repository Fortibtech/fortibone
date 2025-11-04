// src/payments/providers/stripe-connect.provider.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '@prisma/client';

@Injectable()
export class StripeConnectProvider {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('STRIPE_API_KEY');
    this.stripe = new Stripe(apiKey, { apiVersion: '2025-07-30.basil' });
  }

  // Crée un compte connecté Stripe pour un utilisateur s'il n'en a pas
  async findOrCreateConnectedAccount(user: User): Promise<Stripe.Account> {
    if (user.stripeAccountId) {
      return this.stripe.accounts.retrieve(user.stripeAccountId);
    }
    const account = await this.stripe.accounts.create({
      type: 'express', // Le type le plus simple pour les marketplaces
      email: user.email,
      country: 'FR', // Doit être dynamique ou basé sur user.country
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return account;
  }

  // Crée un lien d'onboarding pour que l'utilisateur configure son compte
  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<Stripe.AccountLink> {
    return this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  // Crée un "Payout" (virement) vers le compte connecté de l'utilisateur
  async createPayout(
    accountId: string,
    amount: number,
    currency: string,
  ): Promise<Stripe.Payout> {
    // Le virement est créé depuis le solde de la plateforme vers le compte bancaire de l'utilisateur
    return this.stripe.payouts.create({
      amount: Math.round(amount * 100), // En centimes
      currency,
      destination: accountId, // L'ID du compte bancaire externe est géré par Stripe
    });
  }

  // Crée un "Transfer" (transfert) depuis le solde de la plateforme vers le solde Stripe du compte connecté
  async createTransfer(
    accountId: string,
    amount: number,
    currency: string,
    metadata: any,
  ): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency,
      destination: accountId,
      metadata,
    });
  }
}
