import { Injectable, Inject, MethodNotAllowedException } from '@nestjs/common';
import { ActivoRepository, ActivoFilters } from '../../domain/activo.repository.js';
import { Activo } from '../../domain/activo.entity.js';
import { PrismaLegacyService } from '../../../../shared/infrastructure/database/prisma-legacy.service.js';

@Injectable()
export class LegacyActivoRepository implements ActivoRepository {
  constructor(@Inject(PrismaLegacyService) private readonly prisma: PrismaLegacyService) {}

  async findById(id: string): Promise<Activo | null> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    const row = await this.prisma.inActivo.findUnique({
      where: { nroActivo: numId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCodigo(codigo: string): Promise<Activo | null> {
    const row = await this.prisma.inActivo.findUnique({
      where: { codActivo: codigo },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters): Promise<Activo[]> {
    const rows = await this.prisma.inActivo.findMany({
      where: this.buildWhere(filters),
      take: limit,
      skip: offset,
      orderBy: { nroActivo: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(): Promise<void> {
    throw new MethodNotAllowedException(
      'Direct mutations are prohibited in legacy mode. Switch to hybrid or fresh mode to record changes via event store.'
    );
  }

  async count(filters?: ActivoFilters): Promise<number> {
    return this.prisma.inActivo.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters?: ActivoFilters) {
    if (!filters) return {};
    const where: any = { activo: true };
    if (filters.search) {
      where.codActivo = { contains: filters.search, mode: 'insensitive' };
    }
    return where;
  }

  private toDomain(row: any): Activo {
    return new Activo({
      id: `legacy-${row.nroActivo}`,
      codigo: row.codActivo,
      descripcion: row.descripcion,
      grupoContable: row.codGrupo ? `Grupo-${row.codGrupo}` : 'General',
      ubicacion: 'Legado - Sin Oficina Asignada',
      estado: row.codEstado ? `Estado-${row.codEstado}` : 'BUENO',
      valor: Number(row.monto),
      fechaAlta: row.fecAdqui || row.creadoEn,
      version: 1,
    });
  }
}
