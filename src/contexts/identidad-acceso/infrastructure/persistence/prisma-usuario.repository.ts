import { Injectable, Inject } from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { Usuario } from '../../domain/entities/usuario.entity.js';

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepositoryPort {
  constructor(
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
  ) {}

  async findById(id: string): Promise<Usuario | null> {
    const data = await this.prisma.authUsuario.findUnique({
      where: { id },
    });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const data = await this.prisma.authUsuario.findUnique({
      where: { email },
    });
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByIdentificador(identificador: string): Promise<Usuario | null> {
    const limpio = identificador.trim();
    if (limpio.includes('@')) {
      return this.findByEmail(limpio.toLowerCase());
    }

    const codigoNumerico = Number(limpio);
    if (!Number.isNaN(codigoNumerico)) {
      const data = await this.prisma.authUsuario.findFirst({
        where: { codigoEmpleadoLegado: codigoNumerico },
      });
      if (data) return this.mapToDomain(data);
    }

    return this.findByEmail(limpio);
  }

  async save(usuario: Usuario): Promise<void> {
    const data = {
      id: usuario.id,
      email: usuario.email,
      passwordHash: usuario.passwordHash,
      nombreCompleto: usuario.nombreCompleto,
      cargoInstitucional: usuario.cargoInstitucional,
      estado: usuario.estado as any,
      intentosFallidos: usuario.intentosFallidos,
      bloqueadoHasta: usuario.bloqueadoHasta,
      codigoEmpleadoLegado: usuario.codigoEmpleadoLegado,
      activo: usuario.activo,
      actualizadoEn: new Date(),
    };

    await this.prisma.authUsuario.upsert({
      where: { id: usuario.id },
      create: { ...data, creadoEn: new Date() },
      update: data,
    });
  }

  async findAll(limit = 50, offset = 0): Promise<Usuario[]> {
    const rows = await this.prisma.authUsuario.findMany({
      take: limit,
      skip: offset,
      orderBy: { creadoEn: 'desc' },
    });
    return rows.map(this.mapToDomain);
  }

  async getRolesByUsuarioId(usuarioId: string): Promise<string[]> {
    const roles = await this.prisma.authUsuarioRol.findMany({
      where: { usuarioId },
      select: { rolId: true },
    });
    return roles.map((r) => r.rolId);
  }

  async getPermisosByUsuarioId(usuarioId: string): Promise<string[]> {
    const roles = await this.getRolesByUsuarioId(usuarioId);
    if (roles.length === 0) return [];
    
    const permisos = await this.prisma.authRolPermiso.findMany({
      where: { rolId: { in: roles } },
      select: { permisoId: true },
      distinct: ['permisoId'],
    });
    return permisos.map((p) => p.permisoId);
  }

  private mapToDomain(data: any): Usuario {
    return Usuario.create({
      id: data.id,
      email: data.email,
      passwordHash: data.passwordHash,
      nombreCompleto: data.nombreCompleto,
      cargoInstitucional: data.cargoInstitucional,
      estado: data.estado,
      intentosFallidos: data.intentosFallidos,
      bloqueadoHasta: data.bloqueadoHasta,
      codigoEmpleadoLegado: data.codigoEmpleadoLegado,
      activo: data.activo,
    });
  }
}
