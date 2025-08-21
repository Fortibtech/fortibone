// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

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
}
