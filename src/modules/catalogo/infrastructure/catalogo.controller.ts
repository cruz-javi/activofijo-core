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
  BadRequestException,
} from '@nestjs/common';
import { CatalogoService } from '../application/catalogo.service.js';
import {
  CreateActivoSchema,
  CreateActivoDto,
  UpdateActivoSchema,
  UpdateActivoDto,
} from './catalogo.dto.js';
import { ZodValidationPipe } from '../../../infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../../../infrastructure/security/roles.decorator.js';

@Controller('activos')
export class CatalogoController {
  constructor(@Inject(CatalogoService) private readonly catalogoService: CatalogoService) {}

  @Get()
  async findAll(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('ubicacion') ubicacion?: string,
    @Query('estado') estado?: string,
  ) {
    return this.catalogoService.findAll(parseInt(limit, 10), parseInt(offset, 10), {
      search,
      ubicacion,
      estado,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.catalogoService.findById(id);
  }

  @Get(':id/historial')
  async getHistory(@Param('id') id: string) {
    return this.catalogoService.getHistory(id);
  }

  @Get(':id/depreciacion')
  async getDepreciacion(@Param('id') id: string, @Query('fecha') fecha?: string) {
    const fechaCalculo = this.parseFecha(fecha);
    return this.catalogoService.getDepreciacion(id, fechaCalculo);
  }

  @Get(':id/reconstruccion')
  async reconstruir(
    @Param('id') id: string,
    @Query('version') version?: string,
    @Query('fecha') fecha?: string,
  ) {
    if (!version && !fecha) {
      throw new BadRequestException('Debe indicar el parámetro "version" o "fecha" para reconstruir el estado');
    }
    return this.catalogoService.reconstruirEstado(id, {
      version: version ? parseInt(version, 10) : undefined,
      fecha: this.parseFecha(fecha),
    });
  }

  private parseFecha(fecha?: string): Date | undefined {
    if (!fecha) return undefined;
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${fecha}`);
    }
    return parsed;
  }

  @Post()
  @Roles('ADMIN', 'OFICINA')
  async create(@Body(new ZodValidationPipe(CreateActivoSchema)) body: CreateActivoDto) {
    return this.catalogoService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OFICINA')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateActivoSchema)) body: UpdateActivoDto,
  ) {
    return this.catalogoService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async darDeBaja(
    @Param('id') id: string,
    @Query('expectedVersion') expectedVersion: string,
  ) {
    return this.catalogoService.darDeBaja(id, parseInt(expectedVersion, 10) || 1);
  }
}
