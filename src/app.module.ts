import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { validateEnv } from './config/env.schema.js';
import { PersistenceModule } from './infrastructure/persistence/persistence.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogoModule } from './modules/catalogo/catalogo.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { SincronizacionModule } from './modules/sincronizacion/sincronizacion.module.js';
import { ReglasModule } from './modules/reglas/reglas.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { JwtAuthGuard } from './infrastructure/security/jwt-auth.guard.js';
import { RolesGuard } from './infrastructure/security/roles.guard.js';
import { GlobalHttpExceptionFilter } from './infrastructure/http/filters/http-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PersistenceModule,
    AuthModule,
    CatalogoModule,
    UsuariosModule,
    SincronizacionModule,
    ReglasModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
