import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { ConflictError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Result } from '../../../../shared/domain/result.js';
import { EstadoUsuario } from '../../../../shared/infrastructure/database/generated/core/enums.js';
import argon2 from 'argon2';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  nombreCompleto: true,
  cargoInstitucional: true,
  codigoEmpleadoLegado: true,
  estado: true,
  activo: true,
  intentosFallidos: true,
  twoFactorHabilitado: true,
  bloqueadoHasta: true,
  creadoEn: true,
  actualizadoEn: true,
  roles: {
    select: {
      rol: {
        select: {
          id: true,
          nombre: true,
          descripcion: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class GestionarUsuariosUseCase {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async findAll() {
    const usuarios = await this.prisma.authUsuario.findMany({
      select: PUBLIC_SELECT,
      orderBy: { creadoEn: 'desc' },
    });

    return usuarios.map((u: any) => ({
      ...u,
      roles: u.roles.map((r: any) => r.rol.id),
      rolesDetalle: u.roles.map((r: any) => r.rol),
    }));
  }

  async create(dto: {
    email: string;
    nombre: string;
    passwordRaw: string;
    rol?: string;
    cargoInstitucional?: string;
    codigoEmpleadoLegado?: number;
  }): Promise<Result<any, ConflictError>> {
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
        cargoInstitucional: dto.cargoInstitucional,
        codigoEmpleadoLegado: dto.codigoEmpleadoLegado,
        activo: true,
        estado: EstadoUsuario.ACTIVO,
      },
    });

    const rolAsignar = dto.rol || 'FUNCIONARIO';
    await this.prisma.authUsuarioRol.create({
      data: {
        usuarioId: user.id,
        rolId: rolAsignar,
      },
    });

    return Result.ok({
      id: user.id,
      email: user.email,
      nombreCompleto: user.nombreCompleto,
      cargoInstitucional: user.cargoInstitucional,
      codigoEmpleadoLegado: user.codigoEmpleadoLegado,
      estado: user.estado,
      activo: user.activo,
      roles: [rolAsignar],
    });
  }

  async update(
    id: string,
    dto: { rol?: string; roles?: string[]; activo?: boolean; estado?: string },
  ): Promise<Result<any, NotFoundError>> {
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
        },
      });
    } else if (dto.roles && Array.isArray(dto.roles)) {
      await this.prisma.authUsuarioRol.deleteMany({ where: { usuarioId: id } });
      for (const rId of dto.roles) {
        await this.prisma.authUsuarioRol.create({
          data: {
            usuarioId: id,
            rolId: rId,
          },
        });
      }
    }

    const isUnblocking = dto.estado === EstadoUsuario.ACTIVO || (dto.activo === true && existing.estado.startsWith('BLOQUEADO'));
    const nuevoEstado = dto.estado ? (dto.estado as EstadoUsuario) : isUnblocking ? EstadoUsuario.ACTIVO : undefined;

    const updated = await this.prisma.authUsuario.update({
      where: { id },
      data: {
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(nuevoEstado !== undefined ? { estado: nuevoEstado } : {}),
        ...(isUnblocking ? { intentosFallidos: 0, bloqueadoHasta: null } : {}),
      },
      select: PUBLIC_SELECT,
    });

    return Result.ok({
      ...updated,
      roles: (updated.roles as any[]).map((r: any) => r.rol.id),
      rolesDetalle: (updated.roles as any[]).map((r: any) => r.rol),
    });
  }
}
