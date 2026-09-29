import { describe, it, expect } from 'vitest';
import { generate } from 'otplib';
import { OtplibTotpAdapter } from './otplib-totp.adapter.js';

describe('OtplibTotpAdapter', () => {
  const servicio = new OtplibTotpAdapter();
  const secreto = servicio.generarSecreto();

  it('acepta el código vigente y devuelve su paso', async () => {
    const codigo = await generate({ secret: secreto });
    const resultado = await servicio.verificar(secreto, codigo);
    expect(resultado.valido).toBe(true);
    expect(resultado.paso).toBeTypeOf('number');
  });

  it('acepta el código del paso anterior (tolerancia de reloj)', async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const codigo = await generate({ secret: secreto, epoch: ahora - 30 });
    expect((await servicio.verificar(secreto, codigo)).valido).toBe(true);
  });

  it('rechaza un código de hace más de una ventana', async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const codigo = await generate({ secret: secreto, epoch: ahora - 120 });
    expect((await servicio.verificar(secreto, codigo)).valido).toBe(false);
  });

  it('rechaza reutilizar un código ya aceptado', async () => {
    const codigo = await generate({ secret: secreto });
    const primero = await servicio.verificar(secreto, codigo);
    expect(primero.valido).toBe(true);

    const repetido = await servicio.verificar(secreto, codigo, primero.paso);
    expect(repetido.valido).toBe(false);
  });

  it('rechaza formatos inválidos', async () => {
    for (const codigo of ['', '12345', '1234567', 'abcdef', "' OR '1'='1"]) {
      expect((await servicio.verificar(secreto, codigo)).valido).toBe(false);
    }
  });

  it('genera una URI otpauth con el correo y el emisor', () => {
    const uri = servicio.generarUriOtpauth('admin@uagrm.edu.bo', secreto);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain(`secret=${secreto}`);
    expect(uri).toContain('admin%40uagrm.edu.bo');
  });
});
