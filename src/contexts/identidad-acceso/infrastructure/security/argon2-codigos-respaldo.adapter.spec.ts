import { describe, it, expect } from 'vitest';
import { Argon2CodigosRespaldoAdapter } from './argon2-codigos-respaldo.adapter.js';

describe('Argon2CodigosRespaldoAdapter', () => {
  const servicio = new Argon2CodigosRespaldoAdapter();

  it('genera 10 códigos únicos con formato XXXX-XXXX-XXXX y sus hashes', async () => {
    const { codigosPlano, hashes } = await servicio.generar();
    expect(codigosPlano).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    expect(new Set(codigosPlano).size).toBe(10);
    for (const codigo of codigosPlano) {
      expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
    expect(hashes.every((hash) => !codigosPlano.some((codigo) => hash.includes(codigo)))).toBe(true);
  });

  it('verifica un código sin importar guiones ni mayúsculas', async () => {
    const { codigosPlano, hashes } = await servicio.generar(1);
    const original = codigosPlano[0]!;
    expect(await servicio.verificar(original, hashes[0]!)).toBe(true);
    expect(await servicio.verificar(original.replace(/-/g, '').toLowerCase(), hashes[0]!)).toBe(true);
  });

  it('rechaza un código distinto', async () => {
    const { hashes } = await servicio.generar(1);
    expect(await servicio.verificar('AAAA-BBBB-CCCC', hashes[0]!)).toBe(false);
  });
});
