// src/business/guards/business-admin.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const businessId = request.params.id || request.params.businessId;

    if (!user || !businessId) {
      return false;
    }

    const business = await this.prisma.business.findFirst({
      where: {
        id: businessId,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, role: 'ADMIN' } } },
        ],
      },
    });

    if (!business) {
      throw new ForbiddenException(
        'Vous devez être propriétaire ou administrateur de cette entreprise pour effectuer cette action.',
      );
    }

    return true;
  }
}
