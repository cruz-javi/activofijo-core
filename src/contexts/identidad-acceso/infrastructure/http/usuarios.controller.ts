import { Controller, Inject, Get, Post, Patch, Param, Body, ConflictException, NotFoundException } from '@nestjs/common';
import { GestionarUsuariosUseCase } from '../../application/use-cases/gestionar-usuarios.use-case.js';
import { CreateUsuarioSchema, CreateUsuarioDto, UpdateUsuarioSchema, UpdateUsuarioDto } from '../../application/dto/usuarios.dto.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../security/roles.decorator.js';

@Controller('usuarios')
@Roles('ADMINISTRADOR')
export class UsuariosController {
  constructor(@Inject(GestionarUsuariosUseCase) private readonly gestionarUsuarios: GestionarUsuariosUseCase) {}

  @Get()
  async findAll() {
    return this.gestionarUsuarios.findAll();
  }

  @Post()
  async create(@Body(new ZodValidationPipe(CreateUsuarioSchema)) body: CreateUsuarioDto) {
    const result = await this.gestionarUsuarios.create({
      email: body.email,
      nombre: body.nombre,
      passwordRaw: body.password,
      rol: body.rol,
      cargoInstitucional: body.cargoInstitucional,
      codigoEmpleadoLegado: body.codigoEmpleadoLegado,
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
  ) {
    const result = await this.gestionarUsuarios.update(id, {
      rol: body.rol,
      roles: body.roles,
      activo: body.activo,
      estado: body.estado,
    });

    if (result.isFailure) {
      throw new NotFoundException(result.error?.message);
    }
    return result.getValue();
  }
}
