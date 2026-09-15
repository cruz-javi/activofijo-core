import { Activo } from './activo.entity.js';

export const ACTIVO_REPOSITORY = Symbol('ACTIVO_REPOSITORY');

export interface ActivoRepository {
  findById(id: string): Promise<Activo | null>;
  findByCodigo(codigo: string): Promise<Activo | null>;
  findAll(limit?: number, offset?: number): Promise<Activo[]>;
  save(activo: Activo): Promise<void>;
  count(): Promise<number>;
}
