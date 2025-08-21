// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

// Définir un type pour la réponse enrichie
type BusinessWithRole = Prisma.BusinessGetPayload<{
  include: { owner: { select: { id: true; firstName: true } } };
}> & { userRole: 'OWNER' | MemberRole };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Fonction pour retirer les champs sensibles d'un objet utilisateur
  private secureUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, otp, otpExpiresAt, ...result } = user;
    return result;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        `L'utilisateur avec l'ID ${id} n'a pas été trouvé.`,
      );
    }
    return this.secureUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { dateOfBirth, ...userData } = updateUserDto;

    const dataToUpdate: Prisma.UserUpdateInput = {
      ...userData,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    };

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.secureUser(updatedUser);
  }

  async remove(id: string) {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return {
        message: `L'utilisateur avec l'ID ${id} a été supprimé avec succès.`,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Gère les contraintes de clé étrangère (ex: un utilisateur propriétaire d'une entreprise)
        if (error.code === 'P2003') {
          throw new NotFoundException(
            `Impossible de supprimer l'utilisateur. Il est peut-être lié à d'autres entités (ex: une entreprise).`,
          );
        }
      }
      throw error;
    }
  }

  // --- NOUVELLE FONCTION POUR TROUVER LES ENTREPRISES D'UN UTILISATEUR ---
  async findUserBusinesses(userId: string): Promise<BusinessWithRole[]> {
    const businesses = await this.prisma.business.findMany({
      where: {
        // La condition OR est parfaite pour ce cas :
        // Soit l'utilisateur est le propriétaire,
        // Soit il fait partie des membres de l'entreprise.
        OR: [{ ownerId: userId }, { members: { some: { userId: userId } } }],
      },
      include: {
        // Nous incluons les membres pour déterminer le rôle
        members: {
          where: { userId: userId }, // On ne récupère que l'entrée du membre concerné
          select: { role: true },
        },
        // On inclut aussi le propriétaire pour l'afficher dans les détails
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Enrichir la réponse avec le rôle de l'utilisateur pour chaque entreprise
    const businessesWithRoles = businesses.map((business) => {
      let role: 'OWNER' | MemberRole;

      if (business.ownerId === userId) {
        // Le rôle de propriétaire prime sur tout le reste
        role = 'OWNER';
      } else {
        // Si l'utilisateur n'est pas propriétaire, il est forcément membre
        role = business.members[0].role;
      }

      // Supprimer le champ 'members' qui a servi à notre calcul
      // pour ne pas alourdir la réponse inutilement.
      const { members, ...rest } = business;

      return { ...rest, userRole: role };
    });

    return businessesWithRoles;
  }
}
