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

@Controller('activos')
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

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.patrimonioService.findById(id);
  }

  @Get(':id/historial')
  async getHistory(@Param('id') id: string) {
    return this.patrimonioService.getHistory(id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO')
  async create(@Body(new ZodValidationPipe(CreateActivoSchema)) body: CreateActivoDto) {
    return this.patrimonioService.create(body);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO')
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
