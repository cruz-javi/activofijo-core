import { Controller, Inject, Get, Post, Patch, Param, Body, Req, ConflictException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { GestionarUsuariosUseCase } from '../../application/use-cases/gestionar-usuarios.use-case.js';
import { CreateUsuarioSchema, CreateUsuarioDto, UpdateUsuarioSchema, UpdateUsuarioDto } from '../../application/dto/usuarios.dto.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { ReiniciarDosFactoresUseCase } from '../../application/use-cases/reiniciar-dos-factores.use-case.js';
import { SolicitudAutenticada, obtenerContextoSolicitud } from './solicitud-autenticada.js';
import { mapearErrorDominio } from './mapear-error-dominio.js';
import { Roles } from '../security/roles.decorator.js';
import { RequirePermissions } from '../security/permissions.decorator.js';

@Controller('usuarios')
@Roles('ADMINISTRADOR')
@RequirePermissions('usuarios:gestionar')
export class UsuariosController {
  constructor(
    @Inject(GestionarUsuariosUseCase) private readonly gestionarUsuarios: GestionarUsuariosUseCase,
    @Inject(ReiniciarDosFactoresUseCase) private readonly reiniciarDosFactores: ReiniciarDosFactoresUseCase,
  ) {}

  @Get()
  async findAll() {
    return this.gestionarUsuarios.findAll();
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateUsuarioSchema)) body: CreateUsuarioDto,
    @Req() req: SolicitudAutenticada,
  ) {
    const contexto = obtenerContextoSolicitud(req);
    const result = await this.gestionarUsuarios.create({
      email: body.email,
      nombre: body.nombre,
      passwordRaw: body.password,
      rol: body.rol,
      cargoInstitucional: body.cargoInstitucional,
      codigoEmpleadoLegado: body.codigoEmpleadoLegado,
      ejecutadoPor: req?.user ? { id: req.user.sub, email: req.user.email } : undefined,
      ipOrigen: contexto.ipOrigen,
      userAgent: contexto.userAgent,
    });

    if (result.isFailure) {
      throw new ConflictException(result.error?.message);
    }
    return result.getValue();
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioSchema)) body: UpdateUsuarioDto,
    @Req() req: SolicitudAutenticada,
  ) {
    const contexto = obtenerContextoSolicitud(req);
    const result = await this.gestionarUsuarios.update(id, {
      rol: body.rol,
      roles: body.roles,
      activo: body.activo,
      estado: body.estado,
      ejecutadoPor: req?.user ? { id: req.user.sub, email: req.user.email } : undefined,
      ipOrigen: contexto.ipOrigen,
      userAgent: contexto.userAgent,
    });

    if (result.isFailure) {
      throw new NotFoundException(result.error?.message);
    }
    return result.getValue();
  }

  @Post(':id/reiniciar-2fa')
  async reiniciarDosFactoresDeUsuario(
    @Param('id', new ZodValidationPipe(z.string().uuid())) id: string,
    @Req() req: SolicitudAutenticada,
  ) {
    const result = await this.reiniciarDosFactores.execute({
      usuarioObjetivoId: id,
      ejecutadoPor: { id: req.user.sub, email: req.user.email },
      ...obtenerContextoSolicitud(req),
    });

    if (result.isFailure) {
      throw mapearErrorDominio(result.error);
    }
    return { success: true };
  }
}
