import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import {
  DOS_FACTORES_REPOSITORY_PORT,
  DosFactoresRepositoryPort,
} from '../../domain/ports/dos-factores-repository.port.js';
import {
  DESAFIO_DOS_FACTORES_PORT,
  DesafioDosFactoresPort,
  IdentidadConfiguracion,
  IdentidadResuelta,
} from '../../domain/ports/desafio-dos-factores.port.js';
import { TOTP_PORT, TotpPort } from '../../domain/ports/totp.port.js';
import { SECRETO_CIFRADO_PORT, SecretoCifradoPort } from '../../domain/ports/secreto-cifrado.port.js';
import { CODIGOS_RESPALDO_PORT, CodigosRespaldoPort } from '../../domain/ports/codigos-respaldo.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../../domain/ports/auditoria-acceso.port.js';
import { Usuario } from '../../domain/entities/usuario.entity.js';
import { Result } from '../../../../shared/domain/result.js';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../shared/domain/domain-error.js';
import { EmisorSesionService, SesionIniciada } from '../emisor-sesion.service.js';
import { ValidadorCodigoDosFactoresService } from '../validador-codigo-dos-factores.service.js';
import {
  MENSAJE_CODIGO_INVALIDO,
  MENSAJE_DESAFIO_EXPIRADO,
  MENSAJE_DOS_FACTORES_YA_ACTIVADO,
  MENSAJE_USUARIO_NO_ENCONTRADO,
} from '../mensajes-autenticacion.constants.js';

export interface ActivarDosFactoresRequest {
  identidad: IdentidadConfiguracion;
  codigo: string;
  ipOrigen?: string;
  userAgent?: string;
}

export interface ActivarDosFactoresResponse {
  codigosRespaldo: string[];
  sesion?: SesionIniciada;
}

interface ConfiguracionPendiente {
  usuario: Usuario;
  identidad: IdentidadResuelta;
}

@Injectable()
export class ActivarDosFactoresUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DOS_FACTORES_REPOSITORY_PORT) private readonly dosFactoresRepo: DosFactoresRepositoryPort,
    @Inject(DESAFIO_DOS_FACTORES_PORT) private readonly desafio: DesafioDosFactoresPort,
    @Inject(TOTP_PORT) private readonly totp: TotpPort,
    @Inject(SECRETO_CIFRADO_PORT) private readonly cifrado: SecretoCifradoPort,
    @Inject(CODIGOS_RESPALDO_PORT) private readonly codigosRespaldo: CodigosRespaldoPort,
    @Inject(ValidadorCodigoDosFactoresService) private readonly validador: ValidadorCodigoDosFactoresService,
    @Inject(EmisorSesionService) private readonly emisorSesion: EmisorSesionService,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async execute(req: ActivarDosFactoresRequest): Promise<Result<ActivarDosFactoresResponse, DomainError>> {
    const pendiente = await this.cargarConfiguracionPendiente(req.identidad);
    if (pendiente.isFailure) {
      return Result.fail(pendiente.error as DomainError);
    }
    const { usuario, identidad } = pendiente.getValue();

    const paso = await this.confirmarCodigo(usuario, req);
    if (paso.isFailure) {
      return Result.fail(paso.error as DomainError);
    }

    const codigosRespaldo = await this.registrarActivacion(usuario, paso.getValue(), req);
    if (!identidad.viaDesafio) {
      return Result.ok({ codigosRespaldo });
    }

    const sesion = await this.emisorSesion.emitir(usuario, { deviceId: identidad.deviceId ?? 'web', ipOrigen: req.ipOrigen });
    return Result.ok({ codigosRespaldo, sesion });
  }

  private async cargarConfiguracionPendiente(
    identidad: IdentidadConfiguracion,
  ): Promise<Result<ConfiguracionPendiente, DomainError>> {
    const resuelta = await this.desafio.resolverIdentidad(identidad);
    if (!resuelta) {
      return Result.fail(new UnauthorizedError(MENSAJE_DESAFIO_EXPIRADO));
    }

    const usuario = await this.usuarioRepo.findById(resuelta.usuarioId);
    if (!usuario || !usuario.puedeAutenticarse()) {
      return Result.fail(new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO));
    }
    if (usuario.twoFactorHabilitado) {
      return Result.fail(new ConflictError(MENSAJE_DOS_FACTORES_YA_ACTIVADO));
    }
    if (!usuario.twoFactorSecretCifrado) {
      return Result.fail(new ValidationError('Debe iniciar la configuración antes de confirmar el código'));
    }

    return Result.ok({ usuario, identidad: resuelta });
  }

  private async confirmarCodigo(usuario: Usuario, req: ActivarDosFactoresRequest): Promise<Result<number, DomainError>> {
    const secreto = this.cifrado.descifrar(usuario.twoFactorSecretCifrado as string);
    const verificacion = await this.totp.verificar(secreto, req.codigo);
    if (verificacion.valido && verificacion.paso !== undefined) {
      return Result.ok(verificacion.paso);
    }

    const bloqueado = await this.validador.registrarFallo(usuario, 'ACTIVAR_2FA_FALLIDO', req);
    return Result.fail(
      new UnauthorizedError(
        bloqueado
          ? 'Usuario bloqueado por múltiples intentos fallidos. Consulte con el Administrador del Sistema.'
          : MENSAJE_CODIGO_INVALIDO,
      ),
    );
  }

  private async registrarActivacion(usuario: Usuario, paso: number, req: ActivarDosFactoresRequest): Promise<string[]> {
    const { codigosPlano, hashes } = await this.codigosRespaldo.generar();
    await this.dosFactoresRepo.activar(usuario.id, paso, hashes);

    await this.auditoria.registrar({
      emailUsuario: usuario.email,
      accion: 'ACTIVAR_2FA',
      resultado: 'EXITOSO',
      usuarioId: usuario.id,
      ipOrigen: req.ipOrigen,
      userAgent: req.userAgent,
    });

    return codigosPlano;
  }
}
