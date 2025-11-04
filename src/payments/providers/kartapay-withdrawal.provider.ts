// src/payments/providers/kartapay-withdrawal.provider.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient, User, Wallet } from '@prisma/client';
import {
  WithdrawalProvider,
  WithdrawalResult,
  WithdrawalMethod,
} from '../interfaces/withdrawal-provider.interface';
import { WithdrawalDto } from 'src/wallet/dto/withdrawal.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class KartaPayWithdrawalProvider implements WithdrawalProvider {
  public readonly method = WithdrawalMethod.KARTAPAY_MOBILE_MONEY;

  // Plus besoin de HttpService, ConfigService ou KartaPayProvider ici
  constructor() {}

  async requestWithdrawal(
    user: User,
    wallet: Wallet,
    dto: WithdrawalDto,
    tx: PrismaClient,
  ): Promise<WithdrawalResult> {
    const { amount, mobileMoneyDetails } = dto;

    if (!mobileMoneyDetails || !mobileMoneyDetails.phoneNumber) {
      throw new BadRequestException(
        'Le numéro de téléphone Mobile Money est requis pour ce type de retrait.',
      );
    }

    // 1. Vérifier le solde
    if (wallet.balance.toNumber() < amount) {
      throw new BadRequestException('Solde du portefeuille insuffisant.');
    }

    // 2. Débiter le portefeuille (bloquer les fonds)
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: new Decimal(amount) } },
    });

    // 3. Créer la transaction de retrait avec le statut PENDING
    // Cette transaction servira de "ticket" pour l'administrateur.
    const withdrawalTx = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount: new Prisma.Decimal(-amount),
        status: 'PENDING', // En attente de traitement manuel par un admin
        description: `Demande de retrait KartaPay/Mobile Money vers le numéro ${mobileMoneyDetails.phoneNumber}`,
        metadata: {
          provider: 'KARTAPAY_MOBILE_MONEY',
          details: {
            phoneNumber: mobileMoneyDetails.phoneNumber,
            userName: `${user.firstName} ${user.lastName || ''}`,
          },
        },
      },
    });

    // Pas d'appel API externe, la demande est simplement enregistrée.

    return {
      status: 'PENDING',
      message:
        'Votre demande de retrait a été enregistrée et sera traitée manuellement par notre équipe.',
      withdrawalTransactionId: withdrawalTx.id,
    };
  }
}
