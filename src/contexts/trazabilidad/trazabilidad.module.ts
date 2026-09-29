import { Module } from '@nestjs/common';
import { PrismaEventStoreRepository } from './infrastructure/event-store/prisma-event-store.repository.js';
import { EVENT_STORE_PORT } from './domain/ports/event-store.port.js';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: EVENT_STORE_PORT,
      useClass: PrismaEventStoreRepository,
    },
  ],
  exports: [EVENT_STORE_PORT],
})
export class TrazabilidadModule {}
