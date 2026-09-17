import { Module } from '@nestjs/common';
import { UsuariosService } from './application/usuarios.service.js';
import { UsuariosController } from './infrastructure/usuarios.controller.js';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module.js';

@Module({
  imports: [PersistenceModule],
  providers: [UsuariosService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
