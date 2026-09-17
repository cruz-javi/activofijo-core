import { Module } from '@nestjs/common';
import { SincronizacionService } from './application/sincronizacion.service.js';
import { SincronizacionController } from './infrastructure/sincronizacion.controller.js';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module.js';

@Module({
  imports: [PersistenceModule],
  providers: [SincronizacionService],
  controllers: [SincronizacionController],
  exports: [SincronizacionService],
})
export class SincronizacionModule {}
