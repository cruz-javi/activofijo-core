import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaCoreService } from '../../../infrastructure/persistence/core/prisma-core.service.js';
import { CreateUsuarioDto, UpdateUsuarioDto } from '../infrastructure/usuarios.dto.js';

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async findAll() {
    return this.prisma.usuario.findMany({
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUsuarioDto) {
    const existing = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el correo ${dto.email}`);
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    return this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        rol: dto.rol,
      },
      select: PUBLIC_FIELDS,
    });
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    const existing = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.rol !== undefined ? { rol: dto.rol } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      select: PUBLIC_FIELDS,
    });
  }
}
