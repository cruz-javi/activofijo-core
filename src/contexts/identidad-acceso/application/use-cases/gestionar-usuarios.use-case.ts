import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { ConflictError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Result } from '../../../../shared/domain/result.js';
import argon2 from 'argon2';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  nombreCompleto: true,
  estado: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;

@Injectable()
export class GestionarUsuariosUseCase {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async findAll() {
    return this.prisma.authUsuario.findMany({
      select: PUBLIC_FIELDS,
      orderBy: { creadoEn: 'desc' },
    });
  }

  async create(dto: { email: string; nombre: string; passwordRaw: string; rol?: string }): Promise<Result<any, ConflictError>> {
    const existing = await this.prisma.authUsuario.findUnique({ where: { email: dto.email } });
    if (existing) {
      return Result.fail(new ConflictError(`Ya existe un usuario con el correo ${dto.email}`));
    }

    const passwordHash = await argon2.hash(dto.passwordRaw, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await this.prisma.authUsuario.create({
      data: {
        nombreCompleto: dto.nombre,
        email: dto.email,
        passwordHash,
      },
      select: PUBLIC_FIELDS,
    });

    if (dto.rol) {
      await this.prisma.authUsuarioRol.create({
        data: {
          usuarioId: user.id,
          rolId: dto.rol,
        }
      });
    }

    return Result.ok(user);
  }

  async update(id: string, dto: { rol?: string; activo?: boolean }): Promise<Result<any, NotFoundError>> {
    const existing = await this.prisma.authUsuario.findUnique({ where: { id } });
    if (!existing) {
      return Result.fail(new NotFoundError(`Usuario con id ${id} no encontrado`));
    }

    if (dto.rol) {
      await this.prisma.authUsuarioRol.deleteMany({ where: { usuarioId: id } });
      await this.prisma.authUsuarioRol.create({
        data: {
          usuarioId: id,
          rolId: dto.rol,
        }
      });
    }

    const updated = await this.prisma.authUsuario.update({
      where: { id },
      data: {
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      select: PUBLIC_FIELDS,
    });

    return Result.ok(updated);
  }
}
