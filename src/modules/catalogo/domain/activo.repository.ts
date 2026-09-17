import { Activo } from './activo.entity.js';

export const ACTIVO_REPOSITORY = Symbol('ACTIVO_REPOSITORY');

export interface ActivoFilters {
  search?: string;
  ubicacion?: string;
  estado?: string;
}

export interface ActivoRepository {
  findById(id: string): Promise<Activo | null>;
  findByCodigo(codigo: string): Promise<Activo | null>;
  findAll(limit?: number, offset?: number, filters?: ActivoFilters): Promise<Activo[]>;
  save(activo: Activo): Promise<void>;
  count(filters?: ActivoFilters): Promise<number>;
}
