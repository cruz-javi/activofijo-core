import { Module } from '@nestjs/common';
import { SincronizacionService } from './application/sincronizacion.service.js';
import { SincronizacionController } from './infrastructure/sincronizacion.controller.js';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { TrazabilidadModule } from '../trazabilidad/trazabilidad.module.js';

@Module({
  imports: [DatabaseModule, TrazabilidadModule],
  providers: [SincronizacionService],
  controllers: [SincronizacionController],
  exports: [SincronizacionService],
})
export class SincronizacionModule {}
