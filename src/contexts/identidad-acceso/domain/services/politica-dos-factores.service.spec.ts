import { describe, it, expect } from 'vitest';
import { requiereDosFactores } from './politica-dos-factores.service.js';

describe('requiereDosFactores', () => {
  it('es obligatorio para ADMINISTRADOR y JEFE_ACTIVO_FIJO', () => {
    expect(requiereDosFactores(['ADMINISTRADOR'])).toBe(true);
    expect(requiereDosFactores(['jefe_activo_fijo'])).toBe(true);
  });

  it('es opcional para FUNCIONARIO', () => {
    expect(requiereDosFactores(['FUNCIONARIO'])).toBe(false);
    expect(requiereDosFactores([])).toBe(false);
  });

  it('basta un rol obligatorio entre varios', () => {
    expect(requiereDosFactores(['FUNCIONARIO', 'JEFE_ACTIVO_FIJO'])).toBe(true);
  });
});
