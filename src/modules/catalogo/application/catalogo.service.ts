import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ACTIVO_REPOSITORY, ActivoRepository, ActivoFilters } from '../domain/activo.repository.js';
import { Activo } from '../domain/activo.entity.js';
import { CreateActivoDto, UpdateActivoDto } from '../infrastructure/catalogo.dto.js';
import { EventStoreService } from '../../../infrastructure/event-store/event-store.service.js';
import { ReglasService } from '../../reglas/application/reglas.service.js';
import crypto from 'crypto';

@Injectable()
export class CatalogoService {
  constructor(
    @Inject(ACTIVO_REPOSITORY) private readonly repository: ActivoRepository,
    @Inject(EventStoreService) private readonly eventStore: EventStoreService,
    @Inject(ReglasService) private readonly reglasService: ReglasService,
  ) {}

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters) {
    const items = await this.repository.findAll(limit, offset, filters);
    const total = await this.repository.count(filters);
    return {
      data: items.map((i) => i.toJSON()),
      total,
      limit,
      offset,
    };
  }

  async findById(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException(`Activo with id ${id} not found`);
    return item.toJSON();
  }

  async create(dto: CreateActivoDto) {
    const existing = await this.repository.findByCodigo(dto.codigo);
    if (existing) {
      throw new ConflictException(`Asset with code ${dto.codigo} already exists`);
    }

    const id = crypto.randomUUID();
    const activo = Activo.create({
      id,
      codigo: dto.codigo,
      descripcion: dto.descripcion,
      grupoContable: dto.grupoContable,
      ubicacion: dto.ubicacion,
      estado: dto.estado,
      valor: dto.valor,
      fechaAlta: new Date(),
    });

    await this.repository.save(activo);
    return activo.toJSON();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const activo = await this.repository.findById(id);
    if (!activo) throw new NotFoundException(`Activo with id ${id} not found`);

    if (activo.version !== dto.expectedVersion) {
      throw new ConflictException(
        `Version conflict: current version is ${activo.version}, expected ${dto.expectedVersion}`
      );
    }

    activo.update({
      descripcion: dto.descripcion,
      grupoContable: dto.grupoContable,
      ubicacion: dto.ubicacion,
      estado: dto.estado,
      valor: dto.valor,
    });

    await this.repository.save(activo);
    return activo.toJSON();
  }

  async darDeBaja(id: string, expectedVersion: number) {
    const activo = await this.repository.findById(id);
    if (!activo) throw new NotFoundException(`Activo with id ${id} not found`);

    if (activo.version !== expectedVersion) {
      throw new ConflictException(
        `Version conflict: current version is ${activo.version}, expected ${expectedVersion}`
      );
    }

    activo.darDeBaja();
    await this.repository.save(activo);
    return activo.toJSON();
  }

  async getHistory(id: string) {
    const eventos = await this.eventStore.readStream(id);
    // globalPosition es BigInt y hash/prevHash son Buffer: ninguno de los
    // dos serializa de forma legible con JSON.stringify por defecto. Esta
    // conversión es solo para la respuesta HTTP; el event store internamente
    // sigue trabajando con los tipos crudos (p. ej. para verificar hashes).
    return eventos.map((e) => ({
      ...e,
      globalPosition: e.globalPosition.toString(),
      hash: Buffer.from(e.hash).toString('hex'),
      prevHash: e.prevHash ? Buffer.from(e.prevHash).toString('hex') : null,
    }));
  }

  async getDepreciacion(id: string, fecha?: Date) {
    const activo = await this.repository.findById(id);
    if (!activo) throw new NotFoundException(`Activo with id ${id} not found`);

    return this.reglasService.evaluarDepreciacion(
      { grupoContable: activo.grupoContable, valor: activo.valor, fechaAlta: activo.fechaAlta },
      fecha,
    );
  }

  async reconstruirEstado(id: string, options: { version?: number; fecha?: Date }) {
    const evento = await this.eventStore.reconstructAt(id, {
      version: options.version,
      asOfDate: options.fecha,
    });

    if (!evento) {
      throw new NotFoundException(
        'No existe un estado registrado para este activo en la versión o fecha indicada',
      );
    }

    const integridadVerificada = await this.eventStore.verifyStreamIntegrity(id);

    return {
      ...(evento.payload as Record<string, unknown>),
      _meta: {
        eventType: evento.eventType,
        version: evento.version,
        recordedAt: evento.recordedAt,
        integridadVerificada,
      },
    };
  }
}
