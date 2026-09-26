import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { IdentidadAccesoModule } from './contexts/identidad-acceso/identidad-acceso.module.js';
import { TrazabilidadModule } from './contexts/trazabilidad/trazabilidad.module.js';
import { PatrimonioModule } from './contexts/patrimonio/patrimonio.module.js';
import { SincronizacionModule } from './contexts/sincronizacion/sincronizacion.module.js';
import { TramitesModule } from './contexts/tramites/tramites.module.js';
import { NormativaModule } from './contexts/normativa/normativa.module.js';
import { InspeccionCampoModule } from './contexts/inspeccion-campo/inspeccion-campo.module.js';
import { EtiquetadoImpresionModule } from './contexts/etiquetado-impresion/etiquetado-impresion.module.js';
import { AsistenciaIaModule } from './contexts/asistencia-ia/asistencia-ia.module.js';
import { HealthModule } from './shared/infrastructure/health/health.module.js';
import { JwtAuthGuard } from './contexts/identidad-acceso/infrastructure/security/jwt-auth.guard.js';
import { RolesGuard } from './contexts/identidad-acceso/infrastructure/security/roles.guard.js';
import { GlobalHttpExceptionFilter } from './shared/infrastructure/http/filters/http-exception.filter.js';

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
    DatabaseModule,
    TrazabilidadModule,
    IdentidadAccesoModule,
    PatrimonioModule,
    SincronizacionModule,
    TramitesModule,
    NormativaModule,
    InspeccionCampoModule,
    EtiquetadoImpresionModule,
    AsistenciaIaModule,
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
