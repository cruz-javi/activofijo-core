import { Module } from '@nestjs/common';
import { PatrimonioService } from './application/patrimonio.service.js';
import { PatrimonioController } from './infrastructure/patrimonio.controller.js';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';
import { ACTIVO_REPOSITORY } from './domain/activo.repository.js';
import { HybridActivoRepository } from './infrastructure/persistence/hybrid-activo.repository.js';
import { CoreActivoRepository } from './infrastructure/persistence/core-activo.repository.js';
import { LegacyActivoRepository } from './infrastructure/persistence/legacy-activo.repository.js';
import { TrazabilidadModule } from '../trazabilidad/trazabilidad.module.js';

@Module({
  imports: [DatabaseModule, TrazabilidadModule],
  providers: [
    PatrimonioService,
    CoreActivoRepository,
    LegacyActivoRepository,
    {
      provide: ACTIVO_REPOSITORY,
      useClass: HybridActivoRepository,
    },
  ],
  controllers: [PatrimonioController],
  exports: [PatrimonioService, ACTIVO_REPOSITORY],
})
export class PatrimonioModule {}
