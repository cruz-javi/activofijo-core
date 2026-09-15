import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UsePipes,
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
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get()
  async findAll(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.catalogoService.findAll(parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.catalogoService.findById(id);
  }

  @Get(':id/historial')
  async getHistory(@Param('id') id: string) {
    return this.catalogoService.getHistory(id);
  }

  @Post()
  @Roles('ADMIN', 'INSPECTOR')
  @UsePipes(new ZodValidationPipe(CreateActivoSchema))
  async create(@Body() body: CreateActivoDto) {
    return this.catalogoService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'INSPECTOR')
  @UsePipes(new ZodValidationPipe(UpdateActivoSchema))
  async update(@Param('id') id: string, @Body() body: UpdateActivoDto) {
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
