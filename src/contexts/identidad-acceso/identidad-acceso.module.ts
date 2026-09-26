import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './infrastructure/http/auth.controller.js';
import { UsuariosController } from './infrastructure/http/usuarios.controller.js';
import { AutenticarUsuarioUseCase } from './application/use-cases/autenticar-usuario.use-case.js';
import { RefrescarTokenUseCase } from './application/use-cases/refrescar-token.use-case.js';
import { CerrarSesionUseCase } from './application/use-cases/cerrar-sesion.use-case.js';
import { ObtenerPerfilUseCase } from './application/use-cases/obtener-perfil.use-case.js';
import { GestionarUsuariosUseCase } from './application/use-cases/gestionar-usuarios.use-case.js';
import { PrismaUsuarioRepository } from './infrastructure/persistence/prisma-usuario.repository.js';
import { USUARIO_REPOSITORY_PORT } from './domain/ports/usuario-repository.port.js';
import { TrazabilidadModule } from '../trazabilidad/trazabilidad.module.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
      }),
    }),
    TrazabilidadModule,
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    AutenticarUsuarioUseCase,
    RefrescarTokenUseCase,
    CerrarSesionUseCase,
    ObtenerPerfilUseCase,
    GestionarUsuariosUseCase,
    {
      provide: USUARIO_REPOSITORY_PORT,
      useClass: PrismaUsuarioRepository,
    },
  ],
  exports: [USUARIO_REPOSITORY_PORT, JwtModule],
})
export class IdentidadAccesoModule {}
