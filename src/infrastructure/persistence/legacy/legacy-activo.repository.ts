import { Injectable, Inject, MethodNotAllowedException } from '@nestjs/common';
import { ActivoRepository, ActivoFilters } from '../../../modules/catalogo/domain/activo.repository.js';
import { Activo } from '../../../modules/catalogo/domain/activo.entity.js';
import { PrismaLegacyService } from './prisma-legacy.service.js';

@Injectable()
export class LegacyActivoRepository implements ActivoRepository {
  constructor(@Inject(PrismaLegacyService) private readonly prisma: PrismaLegacyService) {}

  async findById(id: string): Promise<Activo | null> {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;

    const row = await this.prisma.bienesPatrimoniales.findUnique({
      where: { idBien: numId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCodigo(codigo: string): Promise<Activo | null> {
    const row = await this.prisma.bienesPatrimoniales.findUnique({
      where: { codigoAntiguo: codigo },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters): Promise<Activo[]> {
    const rows = await this.prisma.bienesPatrimoniales.findMany({
      where: this.buildWhere(filters),
      take: limit,
      skip: offset,
      orderBy: { idBien: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(): Promise<void> {
    throw new MethodNotAllowedException(
      'Direct mutations are prohibited in legacy mode. Switch to hybrid or fresh mode to record changes via event store.'
    );
  }

  async count(filters?: ActivoFilters): Promise<number> {
    return this.prisma.bienesPatrimoniales.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters?: ActivoFilters) {
    if (!filters) return {};
    const where: Record<string, unknown> = {};
    if (filters.search) {
      where.codigoAntiguo = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.ubicacion) {
      where.OR = [
        { ubicacionEdificio: { contains: filters.ubicacion, mode: 'insensitive' } },
        { ubicacionAula: { contains: filters.ubicacion, mode: 'insensitive' } },
      ];
    }
    if (filters.estado) {
      where.estadoConservacion = filters.estado;
    }
    return where;
  }

  private toDomain(row: any): Activo {
    return new Activo({
      id: `legacy-${row.idBien}`,
      codigo: row.codigoAntiguo,
      descripcion: row.descripcionBien,
      grupoContable: row.categoria,
      ubicacion: `${row.ubicacionEdificio} - ${row.ubicacionAula}`,
      estado: row.estadoConservacion,
      valor: Number(row.valorCompra),
      fechaAlta: row.fechaIncorporacion,
      version: 1,
    });
  }
}
