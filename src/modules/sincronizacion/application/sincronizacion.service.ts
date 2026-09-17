import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaCoreService } from '../../../infrastructure/persistence/core/prisma-core.service.js';
import { PrismaLegacyService } from '../../../infrastructure/persistence/legacy/prisma-legacy.service.js';
import { EventStoreService } from '../../../infrastructure/event-store/event-store.service.js';

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
    @Inject(EventStoreService) private readonly eventStore: EventStoreService,
  ) {}

  async ejecutar(usuarioId: string) {
    let bienes;
    try {
      bienes = await this.prismaLegacy.bienesPatrimoniales.findMany({ orderBy: { idBien: 'asc' } });
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
      const codigo = bien.codigoAntiguo?.trim() || `LEGACY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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
          descripcion: bien.descripcionBien,
          grupoContable: bien.categoria,
          ubicacion: `${bien.ubicacionEdificio} - ${bien.ubicacionAula}`,
          estado: bien.estadoConservacion,
          valor: Number(bien.valorCompra),
          fechaAlta: bien.fechaIncorporacion,
          version: 1,
        };

        await this.eventStore.append({
          streamId: id,
          streamType: 'Activo',
          version: 1,
          eventType: 'ActivoImportadoDesdeLegado',
          payload,
          metadata: { codigoLegado: bien.codigoAntiguo, idBienLegado: bien.idBien },
        });

        await this.prismaCore.activoProyeccion.create({ data: payload });
        importados += 1;
      } catch (error) {
        errores.push({ codigoLegado: bien.codigoAntiguo, error: (error as Error).message });
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
