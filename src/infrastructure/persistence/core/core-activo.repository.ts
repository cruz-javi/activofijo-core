import { Injectable, Inject } from '@nestjs/common';
import { ActivoRepository, ActivoFilters } from '../../../modules/catalogo/domain/activo.repository.js';
import { Activo } from '../../../modules/catalogo/domain/activo.entity.js';
import { PrismaCoreService } from './prisma-core.service.js';
import { EventStoreService } from '../../event-store/event-store.service.js';

@Injectable()
export class CoreActivoRepository implements ActivoRepository {
  constructor(
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
    @Inject(EventStoreService) private readonly eventStore: EventStoreService,
  ) {}

  async findById(id: string): Promise<Activo | null> {
    const row = await this.prisma.activoProyeccion.findUnique({ where: { id } });
    if (!row) return null;
    return new Activo({
      id: row.id,
      codigo: row.codigo,
      descripcion: row.descripcion,
      grupoContable: row.grupoContable,
      ubicacion: row.ubicacion,
      estado: row.estado,
      valor: Number(row.valor),
      fechaAlta: row.fechaAlta,
      version: row.version,
    });
  }

  async findByCodigo(codigo: string): Promise<Activo | null> {
    const row = await this.prisma.activoProyeccion.findUnique({ where: { codigo } });
    if (!row) return null;
    return new Activo({
      id: row.id,
      codigo: row.codigo,
      descripcion: row.descripcion,
      grupoContable: row.grupoContable,
      ubicacion: row.ubicacion,
      estado: row.estado,
      valor: Number(row.valor),
      fechaAlta: row.fechaAlta,
      version: row.version,
    });
  }

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters): Promise<Activo[]> {
    const rows = await this.prisma.activoProyeccion.findMany({
      where: this.buildWhere(filters),
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(
      (row) =>
        new Activo({
          id: row.id,
          codigo: row.codigo,
          descripcion: row.descripcion,
          grupoContable: row.grupoContable,
          ubicacion: row.ubicacion,
          estado: row.estado,
          valor: Number(row.valor),
          fechaAlta: row.fechaAlta,
          version: row.version,
        })
    );
  }

  async save(activo: Activo): Promise<void> {
    const data = activo.toJSON();
    const eventType = data.version === 1 ? 'ActivoCreado' : data.estado === 'BAJA' ? 'ActivoDadoDeBaja' : 'ActivoActualizado';

    await this.eventStore.append({
      streamId: data.id,
      streamType: 'Activo',
      version: data.version,
      eventType,
      payload: data as unknown as Record<string, unknown>,
    });

    await this.prisma.activoProyeccion.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        codigo: data.codigo,
        descripcion: data.descripcion,
        grupoContable: data.grupoContable,
        ubicacion: data.ubicacion,
        estado: data.estado,
        valor: data.valor,
        fechaAlta: data.fechaAlta,
        version: data.version,
      },
      update: {
        codigo: data.codigo,
        descripcion: data.descripcion,
        grupoContable: data.grupoContable,
        ubicacion: data.ubicacion,
        estado: data.estado,
        valor: data.valor,
        version: data.version,
      },
    });
  }

  async count(filters?: ActivoFilters): Promise<number> {
    return this.prisma.activoProyeccion.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters?: ActivoFilters) {
    if (!filters) return {};
    const where: Record<string, unknown> = {};
    if (filters.search) {
      where.codigo = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.ubicacion) {
      where.ubicacion = { contains: filters.ubicacion, mode: 'insensitive' };
    }
    if (filters.estado) {
      where.estado = filters.estado;
    }
    return where;
  }
}
