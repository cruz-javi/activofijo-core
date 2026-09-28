import { Module } from '@nestjs/common';
import { EtiquetadoController } from './infrastructure/http/etiquetado.controller.js';
import { EtiquetadoService } from './application/etiquetado.service.js';

@Module({
  controllers: [EtiquetadoController],
  providers: [EtiquetadoService],
  exports: [EtiquetadoService],
})
export class EtiquetadoImpresionModule {}


