import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ACTIVO_REPOSITORY, ActivoRepository } from '../domain/activo.repository.js';
import { Activo } from '../domain/activo.entity.js';
import { CreateActivoDto, UpdateActivoDto } from '../infrastructure/catalogo.dto.js';
import { EventStoreService } from '../../../infrastructure/event-store/event-store.service.js';
import crypto from 'crypto';

@Injectable()
export class CatalogoService {
  constructor(
    @Inject(ACTIVO_REPOSITORY) private readonly repository: ActivoRepository,
    private readonly eventStore: EventStoreService,
  ) {}

  async findAll(limit = 50, offset = 0) {
    const items = await this.repository.findAll(limit, offset);
    const total = await this.repository.count();
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
    return this.eventStore.readStream(id);
  }
}
