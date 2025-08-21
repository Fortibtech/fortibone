import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { Prisma, User } from '@prisma/client';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { MailService } from 'src/mail/mail.service';
import { ResendOtpDto, ResendOtpType } from './dto/resend-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService, // Injection du MailService
  ) {}

  // --- NOUVELLE FONCTION REGISTER ---
  async register(registerUserDto: RegisterUserDto) {
    const { email, password, invitationToken, ...rest } = registerUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    // Utiliser une transaction Prisma pour assurer l'atomicité
    return this.prisma.$transaction(async (tx) => {
      // 1. Créer l'utilisateur (logique existante)
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP à 6 chiffres
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expiration dans 10 minutes
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          ...rest,
          dateOfBirth: rest.dateOfBirth
            ? new Date(rest.dateOfBirth)
            : undefined,
          otp: otpHash,
          otpExpiresAt,
          isEmailVerified: !!invitationToken,
        },
      });

      // 2. Si un token d'invitation est fourni, le traiter
      if (invitationToken) {
        await this.processInvitation(tx, invitationToken, user);
      } else {
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // OTP à 6 chiffres
        // Envoyer l'e-mail de vérification
        await this.mailService.sendVerificationEmail(user, otp);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;

      return {
        message:
          'Inscription réussie. Veuillez vérifier votre e-mail pour activer votre compte.',
        result,
      };
    });
  }

  private async processInvitation(
    tx: Prisma.TransactionClient,
    token: string,
    user: User,
  ) {
    const invitation = await tx.invitation.findUnique({
      where: { token, status: 'PENDING' },
    });

    if (!invitation) {
      throw new BadRequestException("Lien d'invitation invalide ou expiré.");
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException(
        "Vous devez vous inscrire avec l'email sur lequel vous avez reçu l'invitation.",
      );
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('Cette invitation a expiré.');
    }

    // Créer le lien de membre
    await tx.businessMember.create({
      data: {
        userId: user.id,
        businessId: invitation.businessId,
        role: invitation.role,
      },
    });

    // Mettre à jour le statut de l'invitation
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });
  }

  // --- NOUVELLE FONCTION VERIFY EMAIL ---
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, otp } = verifyEmailDto;

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.otp || !user.otpExpiresAt) {
      throw new BadRequestException('Demande de vérification invalide.');
    }
    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('Le code OTP a expiré.');
    }

    const isOtpMatching = await bcrypt.compare(otp, user.otp);
    if (!isOtpMatching) {
      throw new BadRequestException('Code OTP invalide.');
    }

    // Mettre à jour l'utilisateur
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        otp: null,
        otpExpiresAt: null,
      },
    });

    // Connecter l'utilisateur en retournant un token
    return this._generateToken(user);
  }

  // --- NOUVELLE FONCTION FORGOT PASSWORD ---
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Pour des raisons de sécurité, ne pas indiquer si l'e-mail existe ou non
      return {
        message:
          'Si un compte est associé à cet e-mail, un lien de réinitialisation a été envoyé.',
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otp: hashedOtp,
        otpExpiresAt: otpExpiresAt,
      },
    });

    // Envoyer le code OTP (non haché) par e-mail
    await this.mailService.sendPasswordResetEmail(user, otp);

    return {
      message:
        'Si un compte est associé à cet e-mail, un code de réinitialisation a été envoyé.',
    };
  }

  // --- NOUVELLE VERSION DE resetPassword ---
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otp, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.otp || !user.otpExpiresAt) {
      throw new BadRequestException('Demande de réinitialisation invalide.');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException(
        'Le code OTP de réinitialisation a expiré.',
      );
    }

    const isOtpMatching = await bcrypt.compare(otp, user.otp);
    if (!isOtpMatching) {
      throw new BadRequestException('Code OTP invalide.');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHashedPassword,
        otp: null, // Nettoyer l'OTP après utilisation
        otpExpiresAt: null,
      },
    });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  // --- NOUVELLE FONCTION POUR LE RENVOI D'OTP ---
  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email, type } = resendOtpDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Réponse générique pour la sécurité
      return {
        message:
          'Si un compte est associé à cet e-mail, un nouveau code a été envoyé.',
      };
    }

    // --- Logique de Cooldown (ex: 2 minutes) ---
    const cooldownMinutes = 2;
    if (
      user.lastOtpSentAt &&
      new Date(Date.now() - cooldownMinutes * 60 * 1000) < user.lastOtpSentAt
    ) {
      throw new UnauthorizedException(
        `Veuillez attendre ${cooldownMinutes} minutes avant de demander un nouveau code.`,
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expiration dans 10 minutes

    // Logique conditionnelle basée sur le type de demande
    if (type === ResendOtpType.EMAIL_VERIFICATION) {
      if (user.isEmailVerified) {
        throw new BadRequestException('Cet e-mail est déjà vérifié.');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otp: hashedOtp,
          otpExpiresAt,
          lastOtpSentAt: new Date(),
        },
      });
      await this.mailService.sendVerificationEmail(user, otp);
    } else if (type === ResendOtpType.PASSWORD_RESET) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otp: hashedOtp,
          otpExpiresAt: otpExpiresAt,
          lastOtpSentAt: new Date(),
        },
      });
      await this.mailService.sendPasswordResetEmail(user, otp);
    } else {
      throw new BadRequestException('Type de demande invalide.');
    }

    return {
      message:
        'Si un compte est associé à cet e-mail, un nouveau code a été envoyé.',
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    // 1. Trouver l'utilisateur par email
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        "Veuillez d'abord vérifier votre e-mail.",
      );
    }

    // 2. Comparer les mots de passe
    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    // 3. Générer et retourner le token JWT
    return this._generateToken(user);
  }

  // Fonction privée pour générer un token
  private async _generateToken(user: User) {
    const payload = {
      sub: user.id, // 'sub' est la convention pour le sujet du token (ID de l'utilisateur)
      email: user.email,
      profileType: user.profileType,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  // Fonction pour valider l'utilisateur à partir du payload du token (utilisée par la stratégie JWT)
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result; // Retourne l'utilisateur sans le mot de passe
  }
}
