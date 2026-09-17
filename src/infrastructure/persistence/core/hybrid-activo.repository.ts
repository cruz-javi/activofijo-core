import { Injectable, Inject } from '@nestjs/common';
import { ActivoRepository, ActivoFilters } from '../../../modules/catalogo/domain/activo.repository.js';
import { Activo } from '../../../modules/catalogo/domain/activo.entity.js';
import { CoreActivoRepository } from './core-activo.repository.js';
import { LegacyActivoRepository } from '../legacy/legacy-activo.repository.js';

@Injectable()
export class HybridActivoRepository implements ActivoRepository {
  constructor(
    @Inject(CoreActivoRepository) private readonly coreRepo: CoreActivoRepository,
    @Inject(LegacyActivoRepository) private readonly legacyRepo: LegacyActivoRepository,
  ) {}

  async findById(id: string): Promise<Activo | null> {
    const fromCore = await this.coreRepo.findById(id);
    if (fromCore) return fromCore;
    return this.legacyRepo.findById(id);
  }

  async findByCodigo(codigo: string): Promise<Activo | null> {
    const fromCore = await this.coreRepo.findByCodigo(codigo);
    if (fromCore) return fromCore;
    return this.legacyRepo.findByCodigo(codigo);
  }

  async findAll(limit = 50, offset = 0, filters?: ActivoFilters): Promise<Activo[]> {
    const coreItems = await this.coreRepo.findAll(limit, offset, filters);
    if (coreItems.length >= limit) {
      return coreItems;
    }
    const remaining = limit - coreItems.length;
    const legacyItems = await this.legacyRepo.findAll(remaining, 0, filters);

    const existingCodes = new Set(coreItems.map((item) => item.codigo));
    const nonDuplicatedLegacy = legacyItems.filter((item) => !existingCodes.has(item.codigo));

    return [...coreItems, ...nonDuplicatedLegacy];
  }

  async save(activo: Activo): Promise<void> {
    await this.coreRepo.save(activo);
  }

  async count(filters?: ActivoFilters): Promise<number> {
    const coreCount = await this.coreRepo.count(filters);
    const legacyCount = await this.legacyRepo.count(filters);
    return coreCount + legacyCount;
  }
}
