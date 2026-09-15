import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module.js';

@Module({
  imports: [PersistenceModule],
  controllers: [HealthController],
})
export class HealthModule {}
