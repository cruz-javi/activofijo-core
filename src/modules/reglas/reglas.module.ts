import { Module } from '@nestjs/common';
import { ReglasService } from './application/reglas.service.js';
import { ReglasController } from './infrastructure/reglas.controller.js';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module.js';

@Module({
  imports: [PersistenceModule],
  providers: [ReglasService],
  controllers: [ReglasController],
  exports: [ReglasService],
})
export class ReglasModule {}
