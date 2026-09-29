import {
  Controller,
  Inject,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { EtiquetadoService } from '../../application/etiquetado.service.js';
import {
  GenerarEtiquetasLoteSchema,
  GenerarEtiquetasLoteDto,
  ReponerEtiquetaSchema,
  ReponerEtiquetaDto,
  CrearPlantillaSchema,
  CrearPlantillaDto,
  ActualizarPlantillaSchema,
  ActualizarPlantillaDto,
} from '../../domain/etiqueta.dto.js';
import { ZodValidationPipe } from '../../../../shared/infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../../../identidad-acceso/infrastructure/security/roles.decorator.js';

@Controller('etiquetas')
export class EtiquetadoController {
  constructor(
    @Inject(EtiquetadoService) private readonly etiquetadoService: EtiquetadoService,
  ) {}

  // ==========================================================================
  // GESTIÓN DE PLANTILLAS DE FORMATOS
  // ==========================================================================

  @Get('plantillas')
  async listarPlantillas() {
    return this.etiquetadoService.listarPlantillas();
  }

  @Get('plantillas/:id')
  async obtenerPlantilla(@Param('id') id: string) {
    return this.etiquetadoService.obtenerPlantillaPorId(id);
  }

  @Post('plantillas')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO')
  async crearPlantilla(
    @Body(new ZodValidationPipe(CrearPlantillaSchema)) dto: CrearPlantillaDto,
  ) {
    return this.etiquetadoService.crearPlantilla(dto);
  }

  @Put('plantillas/:id')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO')
  async actualizarPlantilla(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ActualizarPlantillaSchema)) dto: ActualizarPlantillaDto,
  ) {
    return this.etiquetadoService.actualizarPlantilla(id, dto);
  }

  @Delete('plantillas/:id')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO')
  async eliminarPlantilla(@Param('id') id: string) {
    return this.etiquetadoService.eliminarPlantilla(id);
  }

  @Patch('plantillas/:id/predeterminada')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO')
  async establecerPredeterminada(@Param('id') id: string) {
    return this.etiquetadoService.establecerPredeterminada(id);
  }

  // ==========================================================================
  // GENERACIÓN E IMPRESIÓN POR LOTES
  // ==========================================================================

  @Post('generar-lote')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO', 'OPERADOR_PATRIMONIAL')
  async generarEtiquetasLote(
    @Body(new ZodValidationPipe(GenerarEtiquetasLoteSchema)) dto: GenerarEtiquetasLoteDto,
    @Req() req: any,
  ) {
    const ipOrigen = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Sistema Patrimonial UAGRM';
    return this.etiquetadoService.generarEtiquetasLote(dto, req.user, ipOrigen, userAgent);
  }

  // ==========================================================================
  // REPOSICIÓN DE ETIQUETA EN CAMPO / OFICINA (HU3-18)
  // ==========================================================================

  @Post('reponer')
  @Roles('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO', 'ENCARGADO_ACTIVO', 'OPERADOR_PATRIMONIAL', 'INSPECTOR_CAMPO')
  async reponerEtiqueta(
    @Body(new ZodValidationPipe(ReponerEtiquetaSchema)) dto: ReponerEtiquetaDto,
    @Req() req: any,
  ) {
    const ipOrigen = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Sistema Patrimonial UAGRM';
    return this.etiquetadoService.reponerEtiqueta(dto, req.user, ipOrigen, userAgent);
  }

  // ==========================================================================
  // HISTORIAL DE ETIQUETAS
  // ==========================================================================

  @Get('historial/:codActivo')
  async obtenerHistorial(@Param('codActivo') codActivo: string) {
    return this.etiquetadoService.obtenerHistorialActivo(codActivo);
  }
}
