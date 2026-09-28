import { Injectable, Inject, MethodNotAllowedException } from '@nestjs/common';
import { ActivoRepository, ActivoFilters } from '../../domain/activo.repository.js';
import { Activo } from '../../domain/activo.entity.js';
import { PrismaLegacyService } from '../../../../shared/infrastructure/database/prisma-legacy.service.js';

const DEFAULT_INCLUDE = {
  grupo: true,
  unidad: true,
  marca: true,
  modelo: true,
  estado: true,
  condicion: true,
  detallesAsignacion: {
    where: { activo: true },
    include: {
      asignado: {
        include: {
          oficina: true,
          responsable: true,
        },
      },
    },
    take: 1,
  },
};

@Injectable()
export class LegacyActivoRepository implements ActivoRepository {
  constructor(@Inject(PrismaLegacyService) private readonly prisma: PrismaLegacyService) {}

  async findById(id: string): Promise<Activo | null> {
    const rawId = id.startsWith('legacy-') ? id.replace('legacy-', '') : id;
    const numId = parseInt(rawId, 10);
    if (isNaN(numId)) return null;

    const row = await this.prisma.inActivo.findUnique({
      where: { nroActivo: numId },
      include: DEFAULT_INCLUDE,
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCodigo(codigo: string): Promise<Activo | null> {
    const row = await this.prisma.inActivo.findUnique({
      where: { codActivo: codigo },
      include: DEFAULT_INCLUDE,
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters): Promise<Activo[]> {
    const rows = await this.prisma.inActivo.findMany({
      where: this.buildWhere(filters),
      include: DEFAULT_INCLUDE,
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
    if (!filters) return { activo: true };
    const where: any = { activo: true };

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { codActivo: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
        { nroSerie: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.codigo && filters.codigo.trim()) {
      where.codActivo = { contains: filters.codigo.trim(), mode: 'insensitive' };
    }

    if (filters.estado && filters.estado !== 'TODOS') {
      where.estado = {
        desEstado: { equals: filters.estado, mode: 'insensitive' },
      };
    }

    if (filters.grupoContable && filters.grupoContable !== 'TODOS') {
      where.grupo = {
        desGrupo: { contains: filters.grupoContable, mode: 'insensitive' },
      };
    }

    if (filters.unidad && filters.unidad !== 'TODOS') {
      where.detallesAsignacion = {
        some: {
          asignado: {
            oficina: {
              desDpto: { contains: filters.unidad, mode: 'insensitive' },
            },
          },
        },
      };
    }

    if (filters.custodio && filters.custodio.trim()) {
      const c = filters.custodio.trim();
      const numCustodio = parseInt(c, 10);
      where.detallesAsignacion = {
        some: {
          asignado: {
            responsable: {
              OR: [
                { nombres: { contains: c, mode: 'insensitive' } },
                { apellidos: { contains: c, mode: 'insensitive' } },
                { ci: { contains: c } },
                ...(isNaN(numCustodio) ? [] : [{ codEmp: numCustodio }]),
              ],
            },
          },
        },
      };
    }

    return where;
  }

  private toDomain(row: any): Activo {
    const asignacion = row.detallesAsignacion?.[0]?.asignado;
    const oficina = asignacion?.oficina?.desDpto || 'Campus Central UAGRM';
    const resp = asignacion?.responsable;

    const custodio = resp
      ? {
          codigo: resp.codEmp,
          nombreCompleto: `${resp.nombres} ${resp.apellidos}`.trim(),
          cargo: resp.cargo || 'Funcionario Universitario',
          ci: resp.ci,
        }
      : null;

    return new Activo({
      id: `legacy-${row.nroActivo}`,
      codigo: row.codActivo,
      descripcion: row.descripcion,
      grupoContable: row.grupo?.desGrupo || (row.codGrupo ? `Grupo ${row.codGrupo}` : 'Equipos de Computación'),
      ubicacion: oficina,
      unidad: oficina,
      custodio,
      estado: row.estado?.desEstado || 'BUENO',
      condicion: row.condicion?.desCond || 'NUEVO',
      valor: Number(row.monto || 0),
      fechaAlta: row.fecAdqui || row.creadoEn,
      nroSerie: row.nroSerie || null,
      marca: row.marca?.desMarca || null,
      modelo: row.modelo?.desModelo || null,
      version: 1,
    });
  }
}
