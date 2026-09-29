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
} from '../../domain/ports/desafio-dos-factores.port.js';
import { TOTP_PORT, TotpPort } from '../../domain/ports/totp.port.js';
import { SECRETO_CIFRADO_PORT, SecretoCifradoPort } from '../../domain/ports/secreto-cifrado.port.js';
import { Result } from '../../../../shared/domain/result.js';
import { ConflictError, DomainError, NotFoundError, UnauthorizedError } from '../../../../shared/domain/domain-error.js';
import {
  MENSAJE_DESAFIO_EXPIRADO,
  MENSAJE_DOS_FACTORES_YA_ACTIVADO,
  MENSAJE_USUARIO_NO_ENCONTRADO,
} from '../mensajes-autenticacion.constants.js';

export interface ConfigurarDosFactoresResponse {
  secreto: string;
  otpauthUri: string;
}

@Injectable()
export class ConfigurarDosFactoresUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DOS_FACTORES_REPOSITORY_PORT) private readonly dosFactoresRepo: DosFactoresRepositoryPort,
    @Inject(DESAFIO_DOS_FACTORES_PORT) private readonly desafio: DesafioDosFactoresPort,
    @Inject(TOTP_PORT) private readonly totp: TotpPort,
    @Inject(SECRETO_CIFRADO_PORT) private readonly cifrado: SecretoCifradoPort,
  ) {}

  async execute(identidad: IdentidadConfiguracion): Promise<Result<ConfigurarDosFactoresResponse, DomainError>> {
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

    const secreto = this.totp.generarSecreto();
    await this.dosFactoresRepo.guardarSecretoPendiente(usuario.id, this.cifrado.cifrar(secreto));

    return Result.ok({ secreto, otpauthUri: this.totp.generarUriOtpauth(usuario.email, secreto) });
  }
}
