import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaCoreService } from '../../../infrastructure/persistence/core/prisma-core.service.js';
import { ConfiguracionReglasInput, ReglaDepreciacion } from '../domain/regla.schema.js';

const MS_POR_ANIO = 365.25 * 24 * 60 * 60 * 1000;

export interface DepreciacionResult {
  grupoContable: string;
  reglaAplicada: ReglaDepreciacion;
  valorOriginal: number;
  valorActual: number;
  depreciacionAcumulada: number;
  depreciacionAnual: number;
  antiguedadAnios: number;
  vidaUtilRestanteAnios: number;
  totalmenteDepreciado: boolean;
  fechaCalculo: string;
}

@Injectable()
export class ReglasService {
  constructor(@Inject(PrismaCoreService) private readonly prisma: PrismaCoreService) {}

  async getConfiguracionActiva() {
    const config = await this.prisma.configuracionReglas.findFirst({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!config) {
      throw new NotFoundException('No hay ninguna configuración de reglas de depreciación activa');
    }
    return config;
  }

  async listarHistorial() {
    return this.prisma.configuracionReglas.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async crearConfiguracion(dto: ConfiguracionReglasInput, usuarioId: string) {
    const ultima = await this.prisma.configuracionReglas.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (ultima?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.configuracionReglas.updateMany({ where: { activa: true }, data: { activa: false } });
      return tx.configuracionReglas.create({
        data: {
          version,
          reglas: { reglas: dto.reglas, reglaPorDefecto: dto.reglaPorDefecto ?? null } as object,
          resolucion: dto.resolucion,
          descripcion: dto.descripcion,
          activa: true,
          creadoPor: usuarioId,
        },
      });
    });
  }

  async evaluarDepreciacion(
    activo: { grupoContable: string; valor: number; fechaAlta: Date },
    fechaCalculo: Date = new Date(),
  ): Promise<DepreciacionResult> {
    const config = await this.getConfiguracionActiva();
    const contenido = config.reglas as {
      reglas: ReglaDepreciacion[];
      reglaPorDefecto?: Omit<ReglaDepreciacion, 'grupoContable'> | null;
    };

    const normalizado = activo.grupoContable.trim().toLowerCase();
    const reglaEspecifica = contenido.reglas.find(
      (r) => r.grupoContable.trim().toLowerCase() === normalizado,
    );

    const reglaAplicada: ReglaDepreciacion | null = reglaEspecifica
      ? reglaEspecifica
      : contenido.reglaPorDefecto
        ? { grupoContable: activo.grupoContable, ...contenido.reglaPorDefecto }
        : null;

    if (!reglaAplicada) {
      throw new NotFoundException(
        `No hay una regla de depreciación configurada para el grupo contable "${activo.grupoContable}" ni una regla por defecto`,
      );
    }

    const antiguedadAnios = Math.max(
      0,
      (fechaCalculo.getTime() - activo.fechaAlta.getTime()) / MS_POR_ANIO,
    );

    const valorResidual = (activo.valor * reglaAplicada.valorResidualPorcentaje) / 100;
    const baseDepreciable = activo.valor - valorResidual;
    const depreciacionAnual = baseDepreciable / reglaAplicada.vidaUtilAnios;
    const depreciacionAcumulada = Math.min(
      depreciacionAnual * antiguedadAnios,
      baseDepreciable,
    );
    const valorActual = activo.valor - depreciacionAcumulada;
    const vidaUtilRestanteAnios = Math.max(reglaAplicada.vidaUtilAnios - antiguedadAnios, 0);

    return {
      grupoContable: activo.grupoContable,
      reglaAplicada,
      valorOriginal: activo.valor,
      valorActual,
      depreciacionAcumulada,
      depreciacionAnual,
      antiguedadAnios,
      vidaUtilRestanteAnios,
      totalmenteDepreciado: antiguedadAnios >= reglaAplicada.vidaUtilAnios,
      fechaCalculo: fechaCalculo.toISOString(),
    };
  }
}
