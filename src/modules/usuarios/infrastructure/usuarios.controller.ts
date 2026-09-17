import { Controller, Inject, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { UsuariosService } from '../application/usuarios.service.js';
import { CreateUsuarioSchema, CreateUsuarioDto, UpdateUsuarioSchema, UpdateUsuarioDto } from './usuarios.dto.js';
import { ZodValidationPipe } from '../../../infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../../../infrastructure/security/roles.decorator.js';

@Controller('usuarios')
@Roles('ADMIN')
export class UsuariosController {
  constructor(@Inject(UsuariosService) private readonly usuariosService: UsuariosService) {}

  @Get()
  async findAll() {
    return this.usuariosService.findAll();
  }

  @Post()
  async create(@Body(new ZodValidationPipe(CreateUsuarioSchema)) body: CreateUsuarioDto) {
    return this.usuariosService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioSchema)) body: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, body);
  }
}
