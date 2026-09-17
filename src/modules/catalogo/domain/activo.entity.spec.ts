import { describe, it, expect } from 'vitest';
import { Activo } from './activo.entity.js';

function buildActivo(): Activo {
  return Activo.create({
    id: 'test-id',
    codigo: 'UAGRM-TEST-001',
    descripcion: 'Mesa de laboratorio',
    grupoContable: 'Mobiliario',
    ubicacion: 'FICCT',
    estado: 'BUENO',
    valor: 300,
    fechaAlta: new Date('2026-01-01'),
  });
}

describe('Activo (dominio)', () => {
  it('create() inicia la versión en 1', () => {
    const activo = buildActivo();
    expect(activo.version).toBe(1);
  });

  it('update() con un campo parcial conserva los demás campos existentes', () => {
    const activo = buildActivo();

    activo.update({ ubicacion: 'Facultad de Derecho' });

    expect(activo.ubicacion).toBe('Facultad de Derecho');
    expect(activo.descripcion).toBe('Mesa de laboratorio');
    expect(activo.grupoContable).toBe('Mobiliario');
    expect(activo.valor).toBe(300);
    expect(activo.version).toBe(2);
  });

  it('update() incrementa la versión en cada llamada', () => {
    const activo = buildActivo();
    activo.update({ valor: 350 });
    activo.update({ estado: 'REGULAR' });
    expect(activo.version).toBe(3);
  });

  it('darDeBaja() marca el activo como BAJA', () => {
    const activo = buildActivo();
    activo.darDeBaja();
    expect(activo.estado).toBe('BAJA');
  });

  it('update() rechaza modificar un activo ya dado de baja', () => {
    const activo = buildActivo();
    activo.darDeBaja();
    expect(() => activo.update({ ubicacion: 'Otra ubicación' })).toThrow();
  });

  it('darDeBaja() rechaza dar de baja dos veces', () => {
    const activo = buildActivo();
    activo.darDeBaja();
    expect(() => activo.darDeBaja()).toThrow();
  });
});
