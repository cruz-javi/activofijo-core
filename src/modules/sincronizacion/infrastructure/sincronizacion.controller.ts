import { Controller, Inject, Post, Get, Req, Query } from '@nestjs/common';
import { SincronizacionService } from '../application/sincronizacion.service.js';
import { Roles } from '../../../infrastructure/security/roles.decorator.js';

@Controller('sincronizacion')
@Roles('ADMIN')
export class SincronizacionController {
  constructor(
    @Inject(SincronizacionService) private readonly sincronizacionService: SincronizacionService,
  ) {}

  @Post('ejecutar')
  async ejecutar(@Req() req: any) {
    return this.sincronizacionService.ejecutar(req.user.sub);
  }

  @Get('historial')
  async historial(@Query('limit') limit = '20') {
    return this.sincronizacionService.historial(parseInt(limit, 10));
  }
}
