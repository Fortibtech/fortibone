// src/mail/mail.service.ts
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationEmail(user: User, otp: string) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Bienvenue sur FortiBone ! Confirmez votre e-mail',
      html: `
        <h1>Bonjour ${user.firstName},</h1>
        <p>Merci de vous être inscrit sur FortiBone.</p>
        <p>Veuillez utiliser le code suivant pour vérifier votre compte :</p>
        <h2><b>${otp}</b></h2>
        <p>Ce code expirera dans 10 minutes.</p>
      `,
    });
  }

  async sendPasswordResetEmail(user: User, token: string) {
    // En production, le lien doit pointer vers votre frontend
    const resetLink = `http://localhost:3000/auth/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe FortiBone',
      html: `
        <h1>Bonjour ${user.firstName},</h1>
        <p>Vous avez demandé une réinitialisation de mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :</p>
        <a href="${resetLink}">Réinitialiser mon mot de passe</a>
        <p>Ce lien expirera dans 1 heure.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>
      `,
    });
  }
}