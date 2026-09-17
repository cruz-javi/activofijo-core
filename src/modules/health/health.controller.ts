import { Controller, Inject, Get } from '@nestjs/common';
import { Public } from '../../infrastructure/security/public.decorator.js';
import { PrismaCoreService } from '../../infrastructure/persistence/core/prisma-core.service.js';
import { PrismaLegacyService } from '../../infrastructure/persistence/legacy/prisma-legacy.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaCoreService) private readonly prismaCore: PrismaCoreService,
    @Inject(PrismaLegacyService) private readonly prismaLegacy: PrismaLegacyService,
  ) {}

  @Public()
  @Get()
  async check() {
    const start = Date.now();
    let dbStatus = 'up';
    try {
      await this.prismaCore.$queryRawUnsafe('SELECT 1');
    } catch {
      dbStatus = 'down';
    }
    const latencyMs = Date.now() - start;

    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dataSourceMode: process.env.DATA_SOURCE_MODE || 'fresh',
      database: {
        status: dbStatus,
        latencyMs,
      },
    };
  }

  @Public()
  @Get('datasource')
  async dataSourceStatus() {
    const coreCount = await this.prismaCore.activoProyeccion.count().catch(() => -1);
    const legacyCount = await this.prismaLegacy.bienesPatrimoniales.count().catch(() => -1);

    return {
      mode: process.env.DATA_SOURCE_MODE || 'fresh',
      counts: {
        core: coreCount,
        legacy: legacyCount,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
