import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaCoreService } from '../../../shared/infrastructure/database/prisma-core.service.js';
import { PrismaLegacyService } from '../../../shared/infrastructure/database/prisma-legacy.service.js';
import { EventStorePort, EVENT_STORE_PORT } from '../../../contexts/trazabilidad/domain/ports/event-store.port.js';

interface RowError {
  codigoLegado: string;
  error: string;
}

@Injectable()
export class SincronizacionService {
  private readonly logger = new Logger(SincronizacionService.name);

  constructor(
    @Inject(PrismaCoreService) private readonly prismaCore: PrismaCoreService,
    @Inject(PrismaLegacyService) private readonly prismaLegacy: PrismaLegacyService,
    @Inject(EVENT_STORE_PORT) private readonly eventStore: EventStorePort,
  ) {}

  async ejecutar(usuarioId: string) {
    let bienes;
    try {
      bienes = await this.prismaLegacy.inActivo.findMany({ orderBy: { nroActivo: 'asc' } });
    } catch (error) {
      const mensaje = (error as Error).message;
      this.logger.error(`No se pudo conectar al sistema de origen: ${mensaje}`);
      await this.prismaCore.sincronizacionLog.create({
        data: {
          estado: 'FALLIDA',
          registrosImportados: 0,
          registrosOmitidos: 0,
          registrosConError: 0,
          detalle: { error: 'No se pudo conectar al sistema de origen', mensaje } as object,
          ejecutadoPor: usuarioId,
        },
      });
      throw new ServiceUnavailableException('No se pudo conectar al sistema de origen');
    }

    let importados = 0;
    let omitidos = 0;
    const errores: RowError[] = [];

    for (const bien of bienes) {
      const codigo = bien.codActivo?.trim() || `LEGACY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      try {
        const existente = await this.prismaCore.activoProyeccion.findUnique({ where: { codigo } });
        if (existente) {
          omitidos += 1;
          continue;
        }

        const id = crypto.randomUUID();
        const payload = {
          id,
          codigo,
          descripcion: bien.descripcion,
          grupoContable: bien.codGrupo ? `Grupo-${bien.codGrupo}` : 'General',
          ubicacion: 'Ubicacion Legada',
          estado: bien.codEstado ? `Estado-${bien.codEstado}` : 'BUENO',
          valor: Number(bien.monto),
          fechaAlta: bien.fecAdqui || bien.creadoEn,
          version: 1,
        };

        await this.eventStore.append({
          streamId: id,
          streamType: 'Activo',
          version: 1,
          eventType: 'ActivoImportadoDesdeLegado',
          payload,
          metadata: { codigoLegado: bien.codActivo, idBienLegado: bien.nroActivo },
        });

        await this.prismaCore.activoProyeccion.create({ data: payload });
        importados += 1;
      } catch (error) {
        errores.push({ codigoLegado: bien.codActivo, error: (error as Error).message });
      }
    }

    const estado = errores.length > 0 ? 'COMPLETADA_CON_ERRORES' : 'COMPLETADA';
    const log = await this.prismaCore.sincronizacionLog.create({
      data: {
        estado,
        registrosImportados: importados,
        registrosOmitidos: omitidos,
        registrosConError: errores.length,
        detalle: { errores: errores.slice(0, 50) } as object,
        ejecutadoPor: usuarioId,
      },
    });

    return log;
  }

  async historial(limit = 20) {
    return this.prismaCore.sincronizacionLog.findMany({
      orderBy: { fecha: 'desc' },
      take: limit,
    });
  }
}
