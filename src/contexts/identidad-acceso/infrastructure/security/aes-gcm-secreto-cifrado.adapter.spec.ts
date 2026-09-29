import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { AesGcmSecretoCifradoAdapter } from './aes-gcm-secreto-cifrado.adapter.js';

const claveA = crypto.randomBytes(32).toString('hex');
const claveB = crypto.randomBytes(32).toString('hex');

describe('AesGcmSecretoCifradoAdapter', () => {
  const servicio = new AesGcmSecretoCifradoAdapter(claveA);

  it('cifra y descifra el mismo secreto', () => {
    const cifrado = servicio.cifrar('JBSWY3DPEHPK3PXP');
    expect(cifrado).not.toContain('JBSWY3DPEHPK3PXP');
    expect(servicio.descifrar(cifrado)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produce un resultado distinto en cada cifrado (IV aleatorio)', () => {
    expect(servicio.cifrar('JBSWY3DPEHPK3PXP')).not.toBe(servicio.cifrar('JBSWY3DPEHPK3PXP'));
  });

  it('falla al descifrar con otra clave', () => {
    const cifrado = servicio.cifrar('JBSWY3DPEHPK3PXP');
    expect(() => new AesGcmSecretoCifradoAdapter(claveB).descifrar(cifrado)).toThrow();
  });

  it('detecta un valor manipulado', () => {
    const [version, iv, etiqueta, datos] = servicio.cifrar('JBSWY3DPEHPK3PXP').split(':');
    const alterado = Buffer.from(datos!, 'base64');
    alterado[0] = alterado[0]! ^ 0xff;
    expect(() => servicio.descifrar([version, iv, etiqueta, alterado.toString('base64')].join(':'))).toThrow();
  });

  it('rechaza formatos desconocidos y claves inválidas', () => {
    expect(() => servicio.descifrar('texto-plano')).toThrow();
    expect(() => new AesGcmSecretoCifradoAdapter('corta').cifrar('x')).toThrow();
  });
});
