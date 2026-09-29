import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { DESAFIO_DOS_FACTORES_PORT, DesafioDosFactoresPort } from '../../domain/ports/desafio-dos-factores.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../../domain/ports/auditoria-acceso.port.js';
import { Result } from '../../../../shared/domain/result.js';
import { UnauthorizedError } from '../../../../shared/domain/domain-error.js';
import { EmisorSesionService, SesionIniciada } from '../emisor-sesion.service.js';
import { ValidadorCodigoDosFactoresService } from '../validador-codigo-dos-factores.service.js';
import {
  MENSAJE_BLOQUEO_SEGURIDAD,
  MENSAJE_CODIGO_INVALIDO,
  MENSAJE_DESAFIO_EXPIRADO,
} from '../mensajes-autenticacion.constants.js';

export interface VerificarDosFactoresRequest {
  desafioToken: string;
  codigo: string;
  ipOrigen?: string;
  userAgent?: string;
}

@Injectable()
export class VerificarDosFactoresUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DESAFIO_DOS_FACTORES_PORT) private readonly desafio: DesafioDosFactoresPort,
    @Inject(ValidadorCodigoDosFactoresService) private readonly validador: ValidadorCodigoDosFactoresService,
    @Inject(EmisorSesionService) private readonly emisorSesion: EmisorSesionService,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async execute(req: VerificarDosFactoresRequest): Promise<Result<SesionIniciada, UnauthorizedError>> {
    const payload = await this.desafio.validar(req.desafioToken, 'verificar');
    if (!payload) {
      return Result.fail(new UnauthorizedError(MENSAJE_DESAFIO_EXPIRADO));
    }

    const usuario = await this.usuarioRepo.findById(payload.sub);
    if (!usuario || !usuario.puedeAutenticarse() || !usuario.twoFactorHabilitado) {
      return Result.fail(new UnauthorizedError(MENSAJE_DESAFIO_EXPIRADO));
    }

    const metodo = await this.validador.validar(usuario, req.codigo.trim(), true);
    if (!metodo) {
      const bloqueado = await this.validador.registrarFallo(usuario, 'LOGIN_2FA_FALLIDO', req);
      return Result.fail(new UnauthorizedError(bloqueado ? MENSAJE_BLOQUEO_SEGURIDAD : MENSAJE_CODIGO_INVALIDO));
    }

    await this.auditoria.registrar({
      emailUsuario: usuario.email,
      accion: 'LOGIN_2FA_EXITOSO',
      resultado: 'EXITOSO',
      detalle: metodo === 'RESPALDO' ? 'Acceso con código de respaldo' : undefined,
      usuarioId: usuario.id,
      ipOrigen: req.ipOrigen,
      userAgent: req.userAgent,
    });

    return Result.ok(await this.emisorSesion.emitir(usuario, { deviceId: payload.deviceId, ipOrigen: req.ipOrigen }));
  }
}
