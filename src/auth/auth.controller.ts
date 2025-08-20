// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Inscrire un nouvel utilisateur' })
  @ApiResponse({
    status: 201,
    description: "L'utilisateur a été créé avec succès.",
  })
  @ApiResponse({ status: 409, description: "L'email est déjà utilisé." })
  async register(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Connecter un utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie, retourne un token JWT.',
  })
  @ApiResponse({ status: 401, description: 'Identifiants invalides.' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth() // Indique à Swagger que cette route nécessite un token
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: "Retourne les informations de l'utilisateur.",
  })
  @ApiResponse({ status: 401, description: 'Non autorisé.' })
  getProfile(@Request() req) {
    // req.user est peuplé par la stratégie JWT après validation du token
    return req.user;
  }
}
