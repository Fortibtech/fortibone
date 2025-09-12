// src/payments/providers/mvola.provider.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
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
  PaymentTransaction,
  PrismaClient,
  User,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid'; // Pour X-CorrelationID

@Injectable()
export class MvolaProvider implements PaymentProvider {
  public readonly method: PaymentMethodEnum = PaymentMethodEnum.MVOLA;
  private apiBaseTransactionUrl: string; // URL spécifique pour les transactions
  private authUrl: string;
  private clientId: string;
  private clientSecret: string;
  private merchantMsisdn: string; // MSISDN du marchand
  private merchantName: string;
  private callbackUrl: string;
  private webhookSecret: string;

  private accessToken: string;
  private tokenExpiresAt: Date;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiBaseTransactionUrl =
      this.configService.getOrThrow<string>('MVOLA_API_BASE_URL'); // Ceci est l'URL déjà complète
    this.authUrl = this.configService.getOrThrow<string>('MVOLA_AUTH_URL');
    this.clientId = this.configService.getOrThrow<string>('MVOLA_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'MVOLA_CLIENT_SECRET',
    );
    this.merchantMsisdn = this.configService.getOrThrow<string>(
      'MVOLA_MERCHANT_MSISDN',
    );
    this.merchantName = this.configService.getOrThrow<string>(
      'MVOLA_MERCHANT_NAME',
    );
    this.callbackUrl =
      this.configService.getOrThrow<string>('MVOLA_CALLBACK_URL');
    this.webhookSecret = this.configService.getOrThrow<string>(
      'MVOLA_WEBHOOK_SECRET',
    );

    if (
      !this.apiBaseTransactionUrl ||
      !this.clientId ||
      !this.clientSecret ||
      !this.merchantMsisdn ||
      !this.callbackUrl
    ) {
      throw new InternalServerErrorException('Configuration Mvola incomplète.');
    }
  }

  // --- Authentification OAuth2 avec Mvola ---
  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt > new Date(Date.now() + 60 * 1000)
    ) {
      return this.accessToken; // Réutiliser le token s'il est encore valide (avec une marge d'une minute)
    }

    try {
      const authString = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');
      const response = await this.httpService
        .post(
          this.authUrl,
          'grant_type=client_credentials', // La documentation Stripe n'a pas de 'scope', mais Mvola le fait
          {
            headers: {
              Authorization: `Basic ${authString}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )
        .toPromise(); // Convertir l'Observable en Promise

      this.accessToken = response?.data.access_token;
      this.tokenExpiresAt = new Date(
        Date.now() + response?.data.expires_in * 1000,
      ); // expires_in est en secondes
      return this.accessToken;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error(
          'Erreur Mvola OAuth:',
          error.response?.data || error.message,
        );
        throw new InternalServerErrorException(
          `Échec de l'authentification Mvola: ${error.response?.data?.message || error.message}`,
        );
      }
      throw error;
    }
  }

  async createPaymentIntent(
    order: Order,
    user: User,
    tx: PrismaClient,
    metadata?: any,
  ): Promise<PaymentIntentResult> {
    // Mvola a besoin du numéro de téléphone du client (MSISDN)
    if (!user.phoneNumber) {
      throw new BadRequestException(
        "Le numéro de téléphone de l'utilisateur est requis pour les paiements Mvola.",
      );
    }

    try {
      const accessToken = await this.getAccessToken();
      const amount = order.totalAmount.toFixed(0); // DOC: "Amount of transaction without decimals"
      const currency = 'Ar'; // DOC: "Possible Values - Ar"
      const descriptionText = `Paiement commande #${order.orderNumber}`;
      const requestDate = new Date().toISOString().slice(0, -5) + 'Z'; // yyyy-MM-dd'T'HH:mm:ss.SSSZ format
      const clientCorrelationId = uuidv4(); // ID unique pour corréler la requête

      const response = await this.httpService
        .post(
          this.apiBaseTransactionUrl, // L'URL de base inclut déjà le /merchantpay/1.0.0/
          {
            amount: amount,
            currency: currency,
            descriptionText: descriptionText,
            requestingOrganisationTransactionReference: order.id, // Notre ID de commande pour référence
            requestDate: requestDate,
            originalTransactionReference: '', // Non applicable pour une nouvelle transaction
            debitParty: [{ key: 'msisdn', value: user.phoneNumber }], // Le client qui paie
            creditParty: [{ key: 'msisdn', value: this.merchantMsisdn }], // Le marchand qui reçoit
            metadata: [
              { key: 'orderId', value: order.id },
              { key: 'userId', value: user.id },
              { key: 'partnerName', value: this.merchantName },
              // DOC: metadata/fc, metadata/amountFc - si on veut ajouter une devise étrangère (non géré ici pour le moment)
              ...Object.keys(metadata || {}).map((k) => ({
                key: k,
                value: String(metadata[k]),
              })),
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Version: '1.0',
              'X-CorrelationID': clientCorrelationId,
              UserLanguage: 'FR', // Ou 'MG'
              UserAccountIdentifier: `msisdn;${this.merchantMsisdn}`, // MSISDN du compte partenaire
              partnerName: this.merchantName,
              'Content-Type': 'application/json',
              'X-Callback-URL': this.callbackUrl, // L'URL où Mvola renverra le callback
              'Cache-Control': 'no-cache',
            },
          },
        )
        .toPromise();

      // Analyser la réponse Mvola (Response Success, page 4 de la doc)
      const mvolaTransactionStatus = response?.data.status; // "pending"
      const mvolaServerCorrelationId = response?.data.serverCorrelationId; // L'ID de Mvola pour cette transaction

      let status: PaymentStatus;
      switch (mvolaTransactionStatus) {
        case 'pending':
          status = PaymentStatus.PENDING;
          break;
        default:
          status = PaymentStatus.FAILED; // Si ce n'est pas "pending" à l'initiation, c'est une erreur
          break;
      }

      return {
        clientSecret: mvolaServerCorrelationId, // serverCorrelationId est l'équivalent du clientSecret pour le polling
        transactionId: mvolaServerCorrelationId, // L'ID de Mvola pour la transaction
        status: status,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data || error.message;
        console.error('Erreur Mvola createPaymentIntent:', errorData);
        if (error.response?.status === 401) {
          // Invalid Credentials
          throw new UnauthorizedException(
            'Authentification Mvola échouée. Vérifiez les clés API.',
          );
        }
        throw new InternalServerErrorException(
          `Échec d'initiation Mvola: ${error.response?.data?.description || error.message}`,
        );
      }
      throw error;
    }
  }

  async handleWebhook(
    payload: any,
    headers?: Record<string, any>,
  ): Promise<WebhookResult> {
    // --- 1. Vérification de la signature du webhook (si Mvola supporte) ---
    // La documentation fournie ne détaille pas le mécanisme de signature des webhooks Mvola.
    // Il est CRITIQUE de le mettre en place si Mvola fournit ce mécanisme.
    // Pour l'instant, on se base sur la confiance du callback URL (moins sécurisé).
    if (this.webhookSecret) {
      // Logique de vérification de signature Mvola ici
      // Ex: const expectedSignature = crypto.createHmac('sha256', this.webhookSecret).update(JSON.stringify(payload)).digest('hex');
      // if (expectedSignature !== signature) throw new UnauthorizedException('Signature de webhook Mvola invalide.');
      console.warn(
        'Vérification de signature Mvola non implémentée, mais SECRET configuré.',
      );
    } else {
      console.warn(
        'Mvola webhook: SECRET non configuré. Aucune vérification de signature effectuée. NE PAS FAIRE EN PRODUCTION.',
      );
    }

    // --- 2. Analyser le payload Mvola (Success Callback Sample, page 4) ---
    const mvolaEvent = payload;
    const orderId = mvolaEvent.metadata?.find(
      (m) => m.key === 'orderId',
    )?.value;
    const transactionId = mvolaEvent.serverCorrelationId; // L'ID Mvola de la transaction
    const mvolaTransactionStatus = mvolaEvent.transactionStatus; // "completed" ou "failed"

    if (!orderId || !transactionId || !mvolaTransactionStatus) {
      throw new BadRequestException(
        'Payload de webhook Mvola incomplet: orderId, serverCorrelationId ou transactionStatus manquant.',
      );
    }

    let status: PaymentStatus;
    switch (mvolaTransactionStatus) {
      case 'completed':
        status = PaymentStatus.SUCCESS;
        break;
      case 'failed':
        status = PaymentStatus.FAILED;
        break;
      default:
        // Si Mvola envoie d'autres statuts, nous pouvons les mapper ici.
        status = PaymentStatus.PENDING; // Ou un statut d'erreur si inconnu
        console.warn(
          `Statut de transaction Mvola non reconnu: ${mvolaTransactionStatus}`,
        );
        break;
    }

    // DOC: Pas de montant ou devise dans le callback sample, mais crucial pour un webhook réel
    // Vous devrez peut-être faire un GET Transaction Details pour confirmer
    return {
      event: `mvola.transaction.${mvolaTransactionStatus.toLowerCase()}`,
      orderId,
      transactionId,
      status,
      amount: parseFloat(mvolaEvent.amount || '0'), // À récupérer si disponible dans le payload réel
      currency: mvolaEvent.currency || 'Ar', // À récupérer si disponible dans le payload réel
      metadata: mvolaEvent.metadata,
    };
  }

  async refundPayment(
    order: any,
    user: User, // L'utilisateur qui initie le remboursement
    amount?: number, // Montant à rembourser (partiel)
    tx?: PrismaClient, // Transaction Prisma (si utilisée)
  ): Promise<RefundResult> {
    if (!order.paymentIntentId) {
      throw new BadRequestException(
        "Cette commande n'a pas d'ID de transaction Mvola à rembourser.",
      );
    }

    try {
      const accessToken = await this.getAccessToken();
      const refundAmount = amount
        ? new Prisma.Decimal(amount).toFixed(0)
        : order.totalAmount.toFixed(0); // Mvola sans décimales
      const refundCorrelationId = uuidv4();

      // SIMULATION d'appel API de remboursement Mvola (pas de doc explicite pour refund)
      // Généralement, c'est une opération de 'crédit' sur le MSISDN du client
      const response = await this.httpService
        .post(
          `${this.apiBaseTransactionUrl.replace('debitcredit/v1/debit', 'debitcredit/v1/credit')}/init`, // Endpoint de crédit simulé
          {
            amount: refundAmount,
            currency: 'Ar',
            debitParty: [{ key: 'msisdn', value: this.merchantMsisdn }], // Le marchand est le débiteur
            creditParty: [{ key: 'msisdn', value: order.customer.phoneNumber }], // Le client est le créditeur
            clientCorrelationId: refundCorrelationId,
            // Référence à la transaction originale pour le remboursement
            originalTransactionReference: order.paymentIntentId, // L'ID Mvola de la transaction initiale
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Version: '1.0',
              'X-CorrelationID': refundCorrelationId,
              UserLanguage: 'FR',
              UserAccountIdentifier: `msisdn;${this.merchantMsisdn}`,
              partnerName: this.merchantName,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          },
        )
        .toPromise();

      // Analyser la réponse (SIMULATION)
      const mvolaRefundServerCorrelationId = response?.data.serverCorrelationId;
      const mvolaRefundStatus = response?.data.status; // 'pending', 'completed', 'failed'

      return {
        transactionId: mvolaRefundServerCorrelationId,
        status:
          mvolaRefundStatus === 'completed'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PENDING_REFUND,
        amountRefunded: parseFloat(refundAmount),
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error(
          'Erreur Mvola refundPayment:',
          error.response?.data || error.message,
        );
        throw new InternalServerErrorException(
          `Échec du remboursement Mvola: ${error.response?.data?.description || error.message}`,
        );
      }
      throw error;
    }
  }

  async confirmManualPayment(
    order: Order,
    user: User,
    tx: PrismaClient,
    details?: any,
  ): Promise<PaymentTransaction> {
    throw new BadRequestException(
      "Le paiement manuel n'est pas supporté par le fournisseur Mvola.",
    );
  }
}
