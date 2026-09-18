import { Controller, Inject, Get, Post, Body, Req } from '@nestjs/common';
import { ReglasService } from '../application/reglas.service.js';
import { ConfiguracionReglasInputSchema, ConfiguracionReglasInput } from '../domain/regla.schema.js';
import { ZodValidationPipe } from '../../../infrastructure/http/pipes/zod-validation.pipe.js';
import { Roles } from '../../../infrastructure/security/roles.decorator.js';

@Controller('reglas')
export class ReglasController {
  constructor(@Inject(ReglasService) private readonly reglasService: ReglasService) {}

  @Get('configuracion')
  async getActiva() {
    return this.reglasService.getConfiguracionActiva();
  }

  @Get('configuracion/historial')
  @Roles('ADMIN')
  async historial() {
    return this.reglasService.listarHistorial();
  }

  @Post('configuracion')
  @Roles('ADMIN')
  async crear(
    @Body(new ZodValidationPipe(ConfiguracionReglasInputSchema)) body: ConfiguracionReglasInput,
    @Req() req: any,
  ) {
    return this.reglasService.crearConfiguracion(body, req.user.sub);
  }
}
