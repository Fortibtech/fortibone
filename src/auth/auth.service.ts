import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    const { email, password, firstName, lastName, profileType } =
      registerUserDto;

    // 1. Vérifier si l'email existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    // 2. Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Créer l'utilisateur dans la base de données
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        profileType,
      },
    });

    // 4. Retirer le mot de passe de l'objet retourné
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    // 1. Trouver l'utilisateur par email
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
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
