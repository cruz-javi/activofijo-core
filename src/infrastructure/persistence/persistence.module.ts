import { Module, Global } from '@nestjs/common';
import { PrismaCoreService } from './core/prisma-core.service.js';
import { PrismaLegacyService } from './legacy/prisma-legacy.service.js';
import { CoreActivoRepository } from './core/core-activo.repository.js';
import { LegacyActivoRepository } from './legacy/legacy-activo.repository.js';
import { HybridActivoRepository } from './core/hybrid-activo.repository.js';
import { ACTIVO_REPOSITORY } from '../../modules/catalogo/domain/activo.repository.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Global()
@Module({
  providers: [
    PrismaCoreService,
    PrismaLegacyService,
    EventStoreService,
    CoreActivoRepository,
    LegacyActivoRepository,
    HybridActivoRepository,
    {
      provide: ACTIVO_REPOSITORY,
      useFactory: (
        coreRepo: CoreActivoRepository,
        legacyRepo: LegacyActivoRepository,
        hybridRepo: HybridActivoRepository,
      ) => {
        const mode = process.env.DATA_SOURCE_MODE || 'fresh';
        switch (mode) {
          case 'legacy':
            return legacyRepo;
          case 'hybrid':
            return hybridRepo;
          case 'fresh':
          default:
            return coreRepo;
        }
      },
      inject: [CoreActivoRepository, LegacyActivoRepository, HybridActivoRepository],
    },
  ],
  exports: [
    PrismaCoreService,
    PrismaLegacyService,
    EventStoreService,
    ACTIVO_REPOSITORY,
  ],
})
export class PersistenceModule {}
