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
import { PrismaDosFactoresRepository } from './infrastructure/persistence/prisma-dos-factores.repository.js';
import { DOS_FACTORES_REPOSITORY_PORT } from './domain/ports/dos-factores-repository.port.js';
import { TOTP_PORT } from './domain/ports/totp.port.js';
import { SECRETO_CIFRADO_PORT } from './domain/ports/secreto-cifrado.port.js';
import { CODIGOS_RESPALDO_PORT } from './domain/ports/codigos-respaldo.port.js';
import { DESAFIO_DOS_FACTORES_PORT } from './domain/ports/desafio-dos-factores.port.js';
import { TOKEN_ACCESO_PORT } from './domain/ports/token-acceso.port.js';
import { AUDITORIA_ACCESO_PORT } from './domain/ports/auditoria-acceso.port.js';
import { REFRESH_TOKEN_REPOSITORY_PORT } from './domain/ports/refresh-token-repository.port.js';
import { OtplibTotpAdapter } from './infrastructure/security/otplib-totp.adapter.js';
import { AesGcmSecretoCifradoAdapter } from './infrastructure/security/aes-gcm-secreto-cifrado.adapter.js';
import { Argon2CodigosRespaldoAdapter } from './infrastructure/security/argon2-codigos-respaldo.adapter.js';
import { JwtDesafioDosFactoresAdapter } from './infrastructure/security/jwt-desafio-dos-factores.adapter.js';
import { JwtTokenAccesoAdapter } from './infrastructure/security/jwt-token-acceso.adapter.js';
import { PrismaAuditoriaAccesoRepository } from './infrastructure/persistence/prisma-auditoria-acceso.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository.js';
import { EmisorSesionService } from './application/emisor-sesion.service.js';
import { ValidadorCodigoDosFactoresService } from './application/validador-codigo-dos-factores.service.js';
import { VerificarDosFactoresUseCase } from './application/use-cases/verificar-dos-factores.use-case.js';
import { ConfigurarDosFactoresUseCase } from './application/use-cases/configurar-dos-factores.use-case.js';
import { ActivarDosFactoresUseCase } from './application/use-cases/activar-dos-factores.use-case.js';
import { DesactivarDosFactoresUseCase } from './application/use-cases/desactivar-dos-factores.use-case.js';
import { ReiniciarDosFactoresUseCase } from './application/use-cases/reiniciar-dos-factores.use-case.js';
import { TrazabilidadModule } from '../trazabilidad/trazabilidad.module.js';

import { AuditoriaController } from './infrastructure/http/auditoria.controller.js';
import { RolesController } from './infrastructure/http/roles.controller.js';

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
  controllers: [AuthController, UsuariosController, AuditoriaController, RolesController],
  providers: [
    AutenticarUsuarioUseCase,
    RefrescarTokenUseCase,
    CerrarSesionUseCase,
    ObtenerPerfilUseCase,
    GestionarUsuariosUseCase,
    VerificarDosFactoresUseCase,
    ConfigurarDosFactoresUseCase,
    ActivarDosFactoresUseCase,
    DesactivarDosFactoresUseCase,
    ReiniciarDosFactoresUseCase,
    EmisorSesionService,
    ValidadorCodigoDosFactoresService,
    {
      provide: USUARIO_REPOSITORY_PORT,
      useClass: PrismaUsuarioRepository,
    },
    {
      provide: TOTP_PORT,
      useClass: OtplibTotpAdapter,
    },
    {
      provide: SECRETO_CIFRADO_PORT,
      useClass: AesGcmSecretoCifradoAdapter,
    },
    {
      provide: CODIGOS_RESPALDO_PORT,
      useClass: Argon2CodigosRespaldoAdapter,
    },
    {
      provide: DESAFIO_DOS_FACTORES_PORT,
      useClass: JwtDesafioDosFactoresAdapter,
    },
    {
      provide: TOKEN_ACCESO_PORT,
      useClass: JwtTokenAccesoAdapter,
    },
    {
      provide: AUDITORIA_ACCESO_PORT,
      useClass: PrismaAuditoriaAccesoRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY_PORT,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: DOS_FACTORES_REPOSITORY_PORT,
      useClass: PrismaDosFactoresRepository,
    },
  ],
  exports: [USUARIO_REPOSITORY_PORT, JwtModule],
})
export class IdentidadAccesoModule {}
