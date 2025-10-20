// src/payments/providers/kartapay.provider.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotImplementedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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
  PaymentTransaction,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class KartaPayProvider implements PaymentProvider {
  public readonly method: PaymentMethodEnum = PaymentMethodEnum.KARTAPAY; // Renommer MVOLA en KARTAPAY dans l'enum
  private apiBaseUrl: string;
  private authUrl: string;
  private clientId: string;
  private clientSecret: string;
  private webhookSecret: string;
  private successUrl: string;
  private cancelUrl: string;
  private reconciliationClientId: string;
  private merchantId: string;

  private accessToken: string;
  private tokenExpiresAt: Date;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiBaseUrl = this.configService.getOrThrow<string>(
      'KARTAPAY_API_BASE_URL',
    );
    this.authUrl = this.configService.getOrThrow<string>('KARTAPAY_AUTH_URL');
    this.clientId = this.configService.getOrThrow<string>('KARTAPAY_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'KARTAPAY_CLIENT_SECRET',
    );
    this.webhookSecret = this.configService.getOrThrow<string>(
      'KARTAPAY_WEBHOOK_SECRET',
    );
    this.successUrl = this.configService.getOrThrow<string>(
      'FRONTEND_CHECKOUT_SUCCESS_URL',
    );
    this.cancelUrl = this.configService.getOrThrow<string>(
      'FRONTEND_CHECKOUT_CANCEL_URL',
    );
    this.reconciliationClientId = this.configService.getOrThrow<string>(
      'KARTAPAY_CLIENT_ID_RECONCILIATION',
    );
    this.merchantId = this.configService.getOrThrow<string>(
      'KARTAPAY_MERCHANT_ID',
    );

    if (
      !this.apiBaseUrl ||
      !this.authUrl ||
      !this.clientId ||
      !this.clientSecret ||
      !this.webhookSecret ||
      !this.successUrl ||
      !this.cancelUrl
    ) {
      throw new InternalServerErrorException(
        'Configuration KartaPay incomplète.',
      );
    }
  }

  // --- Authentification OAuth2 avec KartaPay (OIDC) ---
  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt > new Date()
    ) {
      return this.accessToken;
    }

    try {
      const response = await this.httpService
        .post(
          this.authUrl,
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials',
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        )
        .toPromise();

      if (!response || !response.data) {
        throw new InternalServerErrorException(
          "Réponse invalide de l'API d'authentification KartaPay.",
        );
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = new Date(
        Date.now() + (response.data.expires_in - 60) * 1000,
      );
      return this.accessToken;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error(
          'Erreur KartaPay OAuth:',
          error.response?.data || error.message,
        );
        throw new InternalServerErrorException(
          "Échec de l'authentification KartaPay.",
        );
      }
      throw error;
    }
  }

  async createPaymentIntent(
    order: Order & { business: { currency: { code: string } } },
    user: User,
    tx: PrismaClient,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    try {
      const accessToken = await this.getAccessToken();
      const amount = order.totalAmount.toNumber();
      const currency = order.business.currency.code; // Ex: "KMF", "EUR"

      const response = await this.httpService
        .post(
          `${this.apiBaseUrl}/v1/payments`,
          {
            purchase: {
              total: {
                value: String(amount),
                currency: currency,
              },
            },
            clientId: this.reconciliationClientId, // Notre ID pour la réconciliation
            cancelUrl: `${this.cancelUrl}?orderId=${order.id}`,
            successUrl: `${this.successUrl}?orderId=${order.id}`,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        )
        .toPromise();

      // Analyser la réponse KartaPay (Example of response, page 3)
      const kartapayTransactionId = response?.data.data.id;
      const kartapayStatus = response?.data.data.status; // "pending"
      const submitUrl = response?.data.data.billing.submitUrl;

      return {
        redirectUrl: submitUrl, // L'URL vers laquelle le frontend doit rediriger
        transactionId: kartapayTransactionId,
        status:
          kartapayStatus === 'pending'
            ? PaymentStatus.PENDING
            : PaymentStatus.FAILED,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error(
          'Erreur KartaPay createPaymentIntent:',
          error.response?.data || error.message,
        );
        throw new InternalServerErrorException(
          'Échec de la création du paiement KartaPay.',
        );
      }
      throw error;
    }
  }

  async handleWebhook(
    payload: any,
    headers?: Record<string, any>,
    prisma?: PrismaClient,
  ): Promise<WebhookResult> {
    // --- 1. Vérification de la signature du webhook HMAC-SHA256 (CRITIQUE) ---
    const signature = headers?.['kartapay-signature']; // Récupérer la signature

    const webhookData = payload.data;
    // DOC: id,merchantId,clientId,value,currency,submittedAt,status
    const messageToVerify = [
      webhookData.id,
      this.merchantId,
      webhookData.clientId,
      webhookData.total.value,
      webhookData.total.currency,
      webhookData.submittedAt,
      webhookData.status,
    ].join(',');

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(messageToVerify)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException(
        'Signature de webhook KartaPay invalide.',
      );
    }

    // --- 2. Analyser le payload KartaPay ---
    const eventTopic = payload.topic; // "payment.completed"
    const transactionId = webhookData.id;
    const kartapayStatus = webhookData.status; // "completed"
    const orderId = webhookData.clientId; // Notre ID de réconciliation (clientId) est l'orderId

    let status: PaymentStatus;
    if (eventTopic === 'payment.completed' && kartapayStatus === 'completed') {
      status = PaymentStatus.SUCCESS;
    } else {
      status = PaymentStatus.FAILED;
    }

    return {
      event: eventTopic,
      orderId,
      transactionId,
      status,
      provider: this.method, // AJOUTER LE FOURNISSEUR
      amount: parseFloat(webhookData.total.value),
      currency: webhookData.total.currency,
      metadata: payload,
    };
  }

  // --- IMPLÉMENTATION DE LA MÉTHODE DE REMBOURSEMENT ---
  async refundPayment(
    order: Order,
    user: User,
    amount?: number,
    tx?: PrismaClient,
  ): Promise<RefundResult> {
    // La documentation de KartaPay ne fournit pas d'endpoint pour les remboursements.
    // L'implémentation la plus sûre est de lever une erreur indiquant que la fonctionnalité n'est pas disponible.
    // Si KartaPay ajoute un jour une API de remboursement, il suffira de remplacer cette logique.

    console.error(
      `Tentative de remboursement pour la commande ${order.id} via KartaPay, qui n'est pas supporté par l'API actuellement.`,
    );

    throw new NotImplementedException(
      "La fonctionnalité de remboursement n'est pas supportée par le fournisseur de paiement KartaPay.",
    );

    /* 
    // EXEMPLE DE CE À QUOI L'IMPLÉMENTATION RESSEMBLERAIT SI L'API EXISTAIT :
    
    if (!order.paymentIntentId) {
        throw new BadRequestException('Cette commande n\'a pas d\'ID de transaction KartaPay à rembourser.');
    }
    
    try {
        const accessToken = await this.getAccessToken();
        const refundAmount = amount ? String(amount) : String(order.totalAmount.toNumber());
        const refundCorrelationId = uuidv4();

        // Appel à un endpoint de remboursement hypothétique de KartaPay
        const response = await this.httpService.post(
            `${this.apiBaseUrl}/v1/payments/${order.paymentIntentId}/refunds`,
            {
                amount: refundAmount,
                reason: `Remboursement initié par ${user.email} pour la commande ${order.orderNumber}`,
            },
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json',
                    'X-CorrelationID': refundCorrelationId,
                },
            },
        ).toPromise();

        const refundData = response.data;
        return {
            transactionId: refundData.id, // ID du remboursement
            status: refundData.status === 'succeeded' ? PaymentStatus.REFUNDED : PaymentStatus.PENDING_REFUND,
            amountRefunded: parseFloat(refundData.amount),
        };

    } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Erreur KartaPay refundPayment:', error.response?.data || error.message);
            throw new InternalServerErrorException(`Échec du remboursement KartaPay: ${error.response?.data?.description || error.message}`);
        }
        throw error;
    }
    */
  }

  // --- IMPLÉMENTATION DE LA MÉTHODE DE PAIEMENT MANUEL ---
  async confirmManualPayment(
    order: Order,
    user: User,
    tx: PrismaClient,
    details?: any,
  ): Promise<PaymentTransaction> {
    // KartaPay est un fournisseur de paiement en ligne. La confirmation manuelle n'a pas de sens dans ce contexte.
    // Cette méthode doit exister pour se conformer à l'interface, mais elle doit lever une erreur si elle est appelée.
    throw new BadRequestException(
      "Le paiement manuel n'est pas applicable au fournisseur de paiement KartaPay.",
    );
  }
}
