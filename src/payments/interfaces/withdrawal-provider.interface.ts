// src/payments/interfaces/withdrawal-provider.interface.ts
import { PrismaClient, User, Wallet } from '@prisma/client';
import { WithdrawalDto, WithdrawalMethod } from 'src/wallet/dto/withdrawal.dto';

// Résultat d'une demande de retrait
export interface WithdrawalResult {
  status: 'PENDING' | 'REQUIRES_SETUP'; // PENDING: en attente de traitement; REQUIRES_SETUP: l'utilisateur doit configurer son compte
  message: string;
  onboardingUrl?: string; // URL pour la configuration du compte
  withdrawalTransactionId: string | null; // ID de notre transaction de portefeuille
}

export abstract class WithdrawalProvider {
  abstract readonly method: WithdrawalMethod; // La méthode que ce provider gère (STRIPE_PAYOUT, etc.)

  abstract requestWithdrawal(
    user: User,
    wallet: Wallet,
    dto: WithdrawalDto,
    tx: PrismaClient,
  ): Promise<WithdrawalResult>;
}

// L'enum WithdrawalMethod doit être importée depuis le DTO
export { WithdrawalMethod } from 'src/wallet/dto/withdrawal.dto';
