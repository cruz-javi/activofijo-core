import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { Roles } from '../security/roles.decorator.js';
import { ResultadoAuditoria } from '../../../../shared/infrastructure/database/generated/core/enums.js';

const ROLES_PROTEGIDOS = ['ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'FUNCIONARIO'];

@Controller()
@Roles('ADMINISTRADOR')
export class RolesController {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  @Get('roles')
  async findAllRoles() {
    const roles = await this.prisma.authRol.findMany({
      include: {
        permisos: {
          include: {
            permiso: true,
          },
        },
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
      orderBy: { creadoEn: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esSistema: r.esSistema,
      totalUsuarios: r._count.usuarios,
      permisos: r.permisos.map((p) => p.permiso),
      permisosIds: r.permisos.map((p) => p.permisoId),
      creadoEn: r.creadoEn,
    }));
  }

  @Post('roles')
  async createRole(
    @Body() body: { id: string; nombre: string; descripcion?: string; permisos?: string[] },
    @Req() req: any,
  ) {
    const roleId = body.id?.trim().toUpperCase();
    if (!roleId || roleId.length < 3) {
      throw new ConflictException('El identificador del rol debe tener al menos 3 caracteres');
    }

    const existing = await this.prisma.authRol.findUnique({ where: { id: roleId } });
    if (existing) {
      throw new ConflictException(`El rol con identificador ${roleId} ya existe`);
    }

    const created = await this.prisma.authRol.create({
      data: {
        id: roleId,
        nombre: body.nombre?.trim() || roleId,
        descripcion: body.descripcion?.trim() || `Rol institucional ${roleId}`,
        esSistema: false,
      },
    });

    if (Array.isArray(body.permisos) && body.permisos.length > 0) {
      for (const pId of body.permisos) {
        await this.prisma.authRolPermiso.create({
          data: {
            rolId: created.id,
            permisoId: pId,
          },
        });
      }
    }

    const clientIp = (req?.headers?.['x-forwarded-for'] as string) || req?.ip || '127.0.0.1';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'Browser';

    // Registrar bitácora de auditoría forense
    await this.registrarBitacora(
      req?.user?.email || 'admin@uagrm.edu.bo',
      'CREAR_ROL',
      'IDENTIDAD_ACCESO',
      created.id,
      ResultadoAuditoria.EXITOSO,
      `Rol ${created.id} creado con ${(body.permisos || []).length} permisos asignados`,
      clientIp,
      userAgent,
    );

    return created;
  }

  @Patch('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { nombre?: string; descripcion?: string; permisos?: string[] },
    @Req() req: any,
  ) {
    const roleId = id.trim().toUpperCase();
    const existing = await this.prisma.authRol.findUnique({ where: { id: roleId } });
    if (!existing) {
      throw new NotFoundException(`Rol ${roleId} no encontrado`);
    }

    const updated = await this.prisma.authRol.update({
      where: { id: roleId },
      data: {
        ...(body.nombre ? { nombre: body.nombre.trim() } : {}),
        ...(body.descripcion ? { descripcion: body.descripcion.trim() } : {}),
      },
    });

    if (Array.isArray(body.permisos)) {
      await this.prisma.authRolPermiso.deleteMany({ where: { rolId: roleId } });
      for (const pId of body.permisos) {
        await this.prisma.authRolPermiso.create({
          data: {
            rolId: roleId,
            permisoId: pId,
          },
        });
      }
    }

    const clientIp = (req?.headers?.['x-forwarded-for'] as string) || req?.ip || '127.0.0.1';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'Browser';

    // Registrar bitácora de auditoría forense
    await this.registrarBitacora(
      req?.user?.email || 'admin@uagrm.edu.bo',
      'ACTUALIZAR_ROL',
      'IDENTIDAD_ACCESO',
      roleId,
      ResultadoAuditoria.EXITOSO,
      `Permisos y detalles del rol ${roleId} actualizados`,
      clientIp,
      userAgent,
    );

    return {
      ...updated,
      permisos: body.permisos || [],
    };
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string, @Req() req: any) {
    const roleId = id.trim().toUpperCase();
    if (ROLES_PROTEGIDOS.includes(roleId)) {
      throw new ForbiddenException(`No se puede eliminar el rol primordial del sistema: ${roleId}`);
    }

    const existing = await this.prisma.authRol.findUnique({ where: { id: roleId } });
    if (!existing) {
      throw new NotFoundException(`Rol ${roleId} no encontrado`);
    }

    // Eliminar asociaciones
    await this.prisma.authRolPermiso.deleteMany({ where: { rolId: roleId } });
    await this.prisma.authUsuarioRol.deleteMany({ where: { rolId: roleId } });
    await this.prisma.authRol.delete({ where: { id: roleId } });

    const clientIp = (req?.headers?.['x-forwarded-for'] as string) || req?.ip || '127.0.0.1';
    const userAgent = (req?.headers?.['user-agent'] as string) || 'Browser';

    // Registrar bitácora de auditoría forense
    await this.registrarBitacora(
      req?.user?.email || 'admin@uagrm.edu.bo',
      'ELIMINAR_ROL',
      'IDENTIDAD_ACCESO',
      roleId,
      ResultadoAuditoria.EXITOSO,
      `Rol personalizado ${roleId} eliminado del sistema`,
      clientIp,
      userAgent,
    );

    return { success: true, message: `Rol ${roleId} eliminado correctamente` };
  }

  @Get('permisos')
  async findAllPermisos() {
    const permisos = await this.prisma.authPermiso.findMany({
      orderBy: [{ modulo: 'asc' }, { id: 'asc' }],
    });

    // Agrupar por módulo
    const modulos: Record<string, typeof permisos> = {};
    for (const p of permisos) {
      if (!modulos[p.modulo]) {
        modulos[p.modulo] = [];
      }
      modulos[p.modulo]!.push(p);
    }

    return {
      total: permisos.length,
      permisos,
      porModulo: modulos,
    };
  }

  private async registrarBitacora(
    emailUsuario: string,
    accion: string,
    modulo: string,
    entidadId: string,
    resultado: ResultadoAuditoria,
    motivoRechazo: string,
    ipOrigen: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.authAuditoriaForense.create({
        data: {
          emailUsuario,
          accion,
          modulo,
          entidadId,
          resultado,
          motivoRechazo,
          ipOrigen,
          userAgent,
        },
      });
    } catch (e) {
      console.warn(`Error al registrar bitácora: ${(e as Error).message}`);
    }
  }
}
