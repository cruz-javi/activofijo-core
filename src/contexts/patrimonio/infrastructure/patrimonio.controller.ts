import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { PatrimonioService } from '../application/patrimonio.service.js';
import {
  CreateActivoSchema,
  CreateActivoDto,
  UpdateActivoSchema,
  UpdateActivoDto,
} from './patrimonio.dto.js';
import { ZodValidationPipe } from '../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../../../contexts/identidad-acceso/infrastructure/security/roles.decorator.js';
import { RequirePermissions } from '../../../contexts/identidad-acceso/infrastructure/security/permissions.decorator.js';

@Controller('activos')
@RequirePermissions('activos:consultar')
export class PatrimonioController {
  constructor(@Inject(PatrimonioService) private readonly patrimonioService: PatrimonioService) {}

  @Get()
  async findAll(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('codigo') codigo?: string,
    @Query('ubicacion') ubicacion?: string,
    @Query('unidad') unidad?: string,
    @Query('custodio') custodio?: string,
    @Query('estado') estado?: string,
    @Query('grupo') grupo?: string,
  ) {
    return this.patrimonioService.findAll(parseInt(limit, 10), parseInt(offset, 10), {
      search,
      codigo,
      ubicacion,
      unidad,
      custodio,
      estado,
      grupoContable: grupo,
    });
  }

  @Get('filtros-metadata')
  async getFiltrosMetadata() {
    return this.patrimonioService.getMetadata();
  }

  @Get('formulario-metadata')
  async getFormularioMetadata() {
    return this.patrimonioService.getFormularioMetadata();
  }

  @Get('resumen-dashboard')
  async getResumenDashboard() {
    return this.patrimonioService.getResumenDashboard();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.patrimonioService.findById(id);
  }

  @Get(':id/historial')
  async getHistory(@Param('id') id: string) {
    return this.patrimonioService.getHistory(id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO', 'OPERADOR_PATRIMONIAL')
  @RequirePermissions('activos:crear')
  async create(
    @Body(new ZodValidationPipe(CreateActivoSchema)) body: CreateActivoDto,
    @Req() req: any,
  ) {
    const user = req.user;
    const ipOrigen = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Browser';
    return this.patrimonioService.create(body, user, ipOrigen, userAgent);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO')
  @RequirePermissions('activos:editar')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateActivoSchema)) body: UpdateActivoDto,
  ) {
    return this.patrimonioService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO')
  async darDeBaja(
    @Param('id') id: string,
    @Query('expectedVersion') expectedVersion: string,
  ) {
    return this.patrimonioService.darDeBaja(id, parseInt(expectedVersion, 10) || 1);
  }
}
