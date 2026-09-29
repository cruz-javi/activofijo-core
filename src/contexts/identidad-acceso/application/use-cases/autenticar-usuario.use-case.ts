import { Injectable, Inject } from '@nestjs/common';
import argon2 from 'argon2';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { DESAFIO_DOS_FACTORES_PORT, DesafioDosFactoresPort } from '../../domain/ports/desafio-dos-factores.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../../domain/ports/auditoria-acceso.port.js';
import { Usuario } from '../../domain/entities/usuario.entity.js';
import { requiereDosFactores } from '../../domain/services/politica-dos-factores.service.js';
import { Result } from '../../../../shared/domain/result.js';
import { UnauthorizedError } from '../../../../shared/domain/domain-error.js';
import { EmisorSesionService, SesionIniciada } from '../emisor-sesion.service.js';
import {
  MENSAJE_BLOQUEO_SEGURIDAD,
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_IDENTIFICADOR_REQUERIDO,
} from '../mensajes-autenticacion.constants.js';

export interface AutenticarUsuarioRequest {
  identificador?: string;
  email?: string;
  passwordRaw: string;
  deviceId?: string;
  ipOrigen?: string;
  userAgent?: string;
}

export type AutenticarUsuarioResponse =
  | SesionIniciada
  | { requiere2fa: true; desafioToken: string }
  | { requiereConfiguracion2fa: true; desafioToken: string };

@Injectable()
export class AutenticarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(EmisorSesionService) private readonly emisorSesion: EmisorSesionService,
    @Inject(DESAFIO_DOS_FACTORES_PORT) private readonly desafio: DesafioDosFactoresPort,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async execute(req: AutenticarUsuarioRequest): Promise<Result<AutenticarUsuarioResponse, UnauthorizedError>> {
    const identificador = (req.identificador || req.email || '').trim();
    if (!identificador) {
      return Result.fail(new UnauthorizedError(MENSAJE_IDENTIFICADOR_REQUERIDO));
    }

    const usuario = await this.usuarioRepo.findByIdentificador(identificador);
    if (!usuario || !usuario.puedeAutenticarse()) {
      return this.rechazarUsuarioInvalido(usuario, identificador, req);
    }

    if (!(await argon2.verify(usuario.passwordHash, req.passwordRaw))) {
      return this.rechazarPasswordIncorrecta(usuario, req);
    }

    return Result.ok(await this.resolverSiguientePaso(usuario, req));
  }

  // Los intentos fallidos no se reinician hasta completar el segundo paso: si no, alternar contraseña correcta y códigos erróneos evadiría el bloqueo.
  private async resolverSiguientePaso(usuario: Usuario, req: AutenticarUsuarioRequest): Promise<AutenticarUsuarioResponse> {
    const deviceId = req.deviceId || 'web';
    const roles = await this.usuarioRepo.getRolesByUsuarioId(usuario.id);

    if (usuario.twoFactorHabilitado) {
      return { requiere2fa: true, desafioToken: await this.desafio.emitir(usuario.id, 'verificar', deviceId) };
    }
    if (requiereDosFactores(roles)) {
      return { requiereConfiguracion2fa: true, desafioToken: await this.desafio.emitir(usuario.id, 'configurar', deviceId) };
    }
    return this.emisorSesion.emitir(usuario, { deviceId, ipOrigen: req.ipOrigen, roles });
  }

  private async rechazarUsuarioInvalido(
    usuario: Usuario | null,
    identificador: string,
    req: AutenticarUsuarioRequest,
  ): Promise<Result<never, UnauthorizedError>> {
    if (usuario?.estaBloqueado()) {
      await this.registrarLogin(usuario.email, 'BLOQUEADO_SEGURIDAD', req, 'Intento de autenticación sobre cuenta con bloqueo definitivo', usuario.id);
      return Result.fail(new UnauthorizedError(MENSAJE_BLOQUEO_SEGURIDAD));
    }

    await this.registrarLogin(identificador, 'DENEGADO_SIN_PERMISO', req, 'Usuario inactivo o no encontrado', usuario?.id);
    return Result.fail(new UnauthorizedError(MENSAJE_CREDENCIALES_INVALIDAS));
  }

  private async rechazarPasswordIncorrecta(
    usuario: Usuario,
    req: AutenticarUsuarioRequest,
  ): Promise<Result<never, UnauthorizedError>> {
    usuario.registrarIntentoFallido();
    await this.usuarioRepo.save(usuario);

    if (usuario.estaBloqueado()) {
      await this.registrarLogin(usuario.email, 'BLOQUEADO_SEGURIDAD', req, 'Bloqueo definitivo activado al alcanzar 5 intentos fallidos consecutivos', usuario.id);
      return Result.fail(new UnauthorizedError(MENSAJE_BLOQUEO_SEGURIDAD));
    }

    await this.registrarLogin(usuario.email, 'DENEGADO_SIN_PERMISO', req, `Contraseña incorrecta (Intento ${usuario.intentosFallidos} de 5)`, usuario.id);
    return Result.fail(new UnauthorizedError(MENSAJE_CREDENCIALES_INVALIDAS));
  }

  private registrarLogin(
    emailUsuario: string,
    resultado: 'DENEGADO_SIN_PERMISO' | 'BLOQUEADO_SEGURIDAD',
    req: AutenticarUsuarioRequest,
    detalle: string,
    usuarioId?: string,
  ): Promise<void> {
    return this.auditoria.registrar({
      emailUsuario,
      accion: 'LOGIN',
      resultado,
      detalle,
      usuarioId,
      ipOrigen: req.ipOrigen,
      userAgent: req.userAgent,
    });
  }
}
