import { Module } from '@nestjs/common';
import { CatalogoService } from './application/catalogo.service.js';
import { CatalogoController } from './infrastructure/catalogo.controller.js';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module.js';
import { ReglasModule } from '../reglas/reglas.module.js';

@Module({
  imports: [PersistenceModule, ReglasModule],
  providers: [CatalogoService],
  controllers: [CatalogoController],
  exports: [CatalogoService],
})
export class CatalogoModule {}
