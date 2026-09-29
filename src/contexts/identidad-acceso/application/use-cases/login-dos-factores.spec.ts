import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { generate } from 'otplib';
import { Usuario } from '../../domain/entities/usuario.entity.js';
import type { UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import type { DosFactoresRepositoryPort, CodigoRespaldoVigente } from '../../domain/ports/dos-factores-repository.port.js';
import type { AuditoriaAccesoPort, RegistroAuditoriaAcceso } from '../../domain/ports/auditoria-acceso.port.js';
import { OtplibTotpAdapter } from '../../infrastructure/security/otplib-totp.adapter.js';
import { AesGcmSecretoCifradoAdapter } from '../../infrastructure/security/aes-gcm-secreto-cifrado.adapter.js';
import { Argon2CodigosRespaldoAdapter } from '../../infrastructure/security/argon2-codigos-respaldo.adapter.js';
import { JwtDesafioDosFactoresAdapter } from '../../infrastructure/security/jwt-desafio-dos-factores.adapter.js';
import { ValidadorCodigoDosFactoresService } from '../validador-codigo-dos-factores.service.js';
import type { EmisorSesionService, SesionIniciada } from '../emisor-sesion.service.js';
import { AutenticarUsuarioUseCase } from './autenticar-usuario.use-case.js';
import { VerificarDosFactoresUseCase } from './verificar-dos-factores.use-case.js';

const PASSWORD = 'ClaveInstitucional#2026';

class UsuarioRepoEnMemoria implements UsuarioRepositoryPort {
  usuarios = new Map<string, Usuario>();
  roles = new Map<string, string[]>();

  async findById(id: string) { return this.usuarios.get(id) ?? null; }
  async findByEmail(email: string) { return [...this.usuarios.values()].find((u) => u.email === email) ?? null; }
  async findByIdentificador(identificador: string) { return this.findByEmail(identificador); }
  async save(usuario: Usuario) { this.usuarios.set(usuario.id, usuario); }
  async findAll() { return [...this.usuarios.values()]; }
  async getRolesByUsuarioId(id: string) { return this.roles.get(id) ?? []; }
  async getPermisosByUsuarioId() { return []; }
}

class DosFactoresRepoEnMemoria implements DosFactoresRepositoryPort {
  pasos = new Map<string, number>();
  respaldo = new Map<string, CodigoRespaldoVigente & { usuarioId: string; usado: boolean }>();

  async guardarSecretoPendiente() {}
  async activar() {}
  async reiniciar() {}
  async registrarPasoSiEsNuevo(usuarioId: string, paso: number) {
    const actual = this.pasos.get(usuarioId);
    if (actual !== undefined && actual >= paso) return false;
    this.pasos.set(usuarioId, paso);
    return true;
  }
  async obtenerCodigosRespaldoVigentes(usuarioId: string) {
    return [...this.respaldo.values()].filter((c) => c.usuarioId === usuarioId && !c.usado);
  }
  async consumirCodigoRespaldo(codigoId: string) {
    const codigo = this.respaldo.get(codigoId);
    if (!codigo || codigo.usado) return false;
    codigo.usado = true;
    return true;
  }
}

describe('Inicio de sesión con verificación en dos pasos', () => {
  const totp = new OtplibTotpAdapter();
  const jwt = new JwtService();
  const desafio = new JwtDesafioDosFactoresAdapter(jwt);
  const respaldo = new Argon2CodigosRespaldoAdapter();
  let cifrado: AesGcmSecretoCifradoAdapter;
  let passwordHash: string;

  let usuarios: UsuarioRepoEnMemoria;
  let dosFactores: DosFactoresRepoEnMemoria;
  let auditoria: RegistroAuditoriaAcceso[];
  let sesionesEmitidas: string[];
  let autenticar: AutenticarUsuarioUseCase;
  let verificar: VerificarDosFactoresUseCase;

  const sesionFalsa = (id: string) => ({ accessToken: `acc-${id}`, refreshToken: `ref-${id}` }) as SesionIniciada;

  function crearUsuario(id: string, rol: string, conDosFactores: boolean) {
    const secreto = totp.generarSecreto();
    const usuario = Usuario.create({
      id,
      email: `${id}@uagrm.edu.bo`,
      passwordHash,
      nombreCompleto: id,
      estado: 'ACTIVO',
      intentosFallidos: 0,
      activo: true,
      twoFactorHabilitado: conDosFactores,
      twoFactorSecretCifrado: conDosFactores ? cifrado.cifrar(secreto) : null,
    });
    usuarios.usuarios.set(id, usuario);
    usuarios.roles.set(id, [rol]);
    return { usuario, secreto };
  }

  beforeAll(async () => {
    process.env.JWT_2FA_SECRET = crypto.randomBytes(48).toString('base64url');
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
    process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    cifrado = new AesGcmSecretoCifradoAdapter();
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(() => {
    usuarios = new UsuarioRepoEnMemoria();
    dosFactores = new DosFactoresRepoEnMemoria();
    auditoria = [];
    sesionesEmitidas = [];

    const registrador = { registrar: async (r: RegistroAuditoriaAcceso) => void auditoria.push(r) } as unknown as AuditoriaAccesoPort;
    const emisor = {
      emitir: async (usuario: Usuario) => {
        usuario.resetearIntentosFallidos();
        sesionesEmitidas.push(usuario.id);
        return sesionFalsa(usuario.id);
      },
    } as unknown as EmisorSesionService;
    const validador = new ValidadorCodigoDosFactoresService(usuarios, dosFactores, totp, cifrado, respaldo, registrador);

    autenticar = new AutenticarUsuarioUseCase(usuarios, emisor, desafio, registrador);
    verificar = new VerificarDosFactoresUseCase(usuarios, desafio, validador, emisor, registrador);
  });

  const login = (id: string, password = PASSWORD) => autenticar.execute({ identificador: `${id}@uagrm.edu.bo`, passwordRaw: password, deviceId: 'web' });

  describe('paso 1: contraseña', () => {
    it('FUNCIONARIO sin 2FA recibe la sesión directamente', async () => {
      crearUsuario('func', 'FUNCIONARIO', false);
      const resultado = await login('func');
      expect(resultado.getValue()).toMatchObject({ accessToken: 'acc-func' });
    });

    it('usuario con 2FA recibe un desafío y ninguna sesión', async () => {
      const { usuario } = crearUsuario('conDos', 'FUNCIONARIO', true);
      usuario.registrarIntentoFallido();

      const valor = (await login('conDos')).getValue();
      expect(valor).toMatchObject({ requiere2fa: true });
      expect(sesionesEmitidas).toEqual([]);
      expect(usuario.intentosFallidos).toBe(1);
    });

    it('ADMINISTRADOR sin 2FA debe configurarlo antes de entrar', async () => {
      crearUsuario('admin', 'ADMINISTRADOR', false);
      expect((await login('admin')).getValue()).toMatchObject({ requiereConfiguracion2fa: true });
      expect(sesionesEmitidas).toEqual([]);
    });

    it('JEFE_ACTIVO_FIJO sin 2FA debe configurarlo antes de entrar', async () => {
      crearUsuario('jefe', 'JEFE_ACTIVO_FIJO', false);
      expect((await login('jefe')).getValue()).toMatchObject({ requiereConfiguracion2fa: true });
    });

    it('contraseña incorrecta responde con el mensaje genérico', async () => {
      crearUsuario('func', 'FUNCIONARIO', false);
      const resultado = await login('func', 'otra-clave');
      expect(resultado.isFailure).toBe(true);
      expect(resultado.error?.message).toBe('Credenciales inválidas');
    });
  });

  describe('paso 2: código de verificación', () => {
    async function desafioPara(id: string) {
      const valor = (await login(id)).getValue() as { desafioToken: string };
      return valor.desafioToken;
    }

    it('un código TOTP válido emite la sesión y reinicia los intentos', async () => {
      const { usuario, secreto } = crearUsuario('admin', 'ADMINISTRADOR', true);
      usuario.registrarIntentoFallido();

      const codigo = await generate({ secret: secreto });
      const resultado = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo });

      expect(resultado.getValue()).toMatchObject({ accessToken: 'acc-admin' });
      expect(usuario.intentosFallidos).toBe(0);
      expect(auditoria.map((a) => a.accion)).toContain('LOGIN_2FA_EXITOSO');
    });

    it('rechaza reutilizar un código ya aceptado', async () => {
      const { secreto } = crearUsuario('admin', 'ADMINISTRADOR', true);
      const codigo = await generate({ secret: secreto });

      const primero = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo });
      const repetido = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo });

      expect(primero.isSuccess).toBe(true);
      expect(repetido.isFailure).toBe(true);
      expect(sesionesEmitidas).toEqual(['admin']);
    });

    it('un código incorrecto suma un intento fallido y queda en bitácora', async () => {
      const { usuario } = crearUsuario('admin', 'ADMINISTRADOR', true);

      const resultado = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo: '000000' });

      expect(resultado.error?.message).toBe('Código de verificación inválido o vencido');
      expect(usuario.intentosFallidos).toBe(1);
      expect(auditoria.at(-1)).toMatchObject({ accion: 'LOGIN_2FA_FALLIDO', resultado: 'DENEGADO_SIN_PERMISO' });
    });

    it('cinco códigos incorrectos bloquean la cuenta', async () => {
      const { usuario } = crearUsuario('admin', 'ADMINISTRADOR', true);
      const desafioToken = await desafioPara('admin');

      let ultimo;
      for (let i = 0; i < 5; i++) {
        ultimo = await verificar.execute({ desafioToken, codigo: '000000' });
      }

      expect(usuario.estaBloqueado()).toBe(true);
      expect(ultimo?.error?.message).toContain('bloqueado');
      expect(auditoria.at(-1)?.resultado).toBe('BLOQUEADO_SEGURIDAD');
    });

    it('un código de respaldo sirve una sola vez', async () => {
      crearUsuario('admin', 'ADMINISTRADOR', true);
      const { codigosPlano, hashes } = await respaldo.generar(2);
      hashes.forEach((codigoHash, i) => dosFactores.respaldo.set(`c${i}`, { id: `c${i}`, codigoHash, usuarioId: 'admin', usado: false }));

      const primero = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo: codigosPlano[0]! });
      const repetido = await verificar.execute({ desafioToken: await desafioPara('admin'), codigo: codigosPlano[0]! });

      expect(primero.isSuccess).toBe(true);
      expect(repetido.isFailure).toBe(true);
    });

    it('rechaza un token de acceso usado como desafío', async () => {
      const { secreto } = crearUsuario('admin', 'ADMINISTRADOR', true);
      const tokenDeAcceso = await jwt.signAsync({ sub: 'admin', roles: ['ADMINISTRADOR'] }, { secret: process.env.JWT_SECRET });

      const resultado = await verificar.execute({ desafioToken: tokenDeAcceso, codigo: await generate({ secret: secreto }) });
      expect(resultado.isFailure).toBe(true);
      expect(sesionesEmitidas).toEqual([]);
    });

    it('rechaza un desafío de otra fase', async () => {
      const { secreto } = crearUsuario('admin', 'ADMINISTRADOR', true);
      const desafioConfigurar = await desafio.emitir('admin', 'configurar', 'web');

      const resultado = await verificar.execute({ desafioToken: desafioConfigurar, codigo: await generate({ secret: secreto }) });
      expect(resultado.isFailure).toBe(true);
    });
  });
});
