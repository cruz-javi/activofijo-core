import { Injectable, Inject } from '@nestjs/common';
import argon2 from 'argon2';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import {
  DOS_FACTORES_REPOSITORY_PORT,
  DosFactoresRepositoryPort,
} from '../../domain/ports/dos-factores-repository.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../../domain/ports/auditoria-acceso.port.js';
import { requiereDosFactores } from '../../domain/services/politica-dos-factores.service.js';
import { Result } from '../../../../shared/domain/result.js';
import {
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../shared/domain/domain-error.js';
import { ValidadorCodigoDosFactoresService } from '../validador-codigo-dos-factores.service.js';
import { MENSAJE_USUARIO_NO_ENCONTRADO } from '../mensajes-autenticacion.constants.js';

export interface DesactivarDosFactoresRequest {
  usuarioId: string;
  password: string;
  codigo: string;
  ipOrigen?: string;
  userAgent?: string;
}

@Injectable()
export class DesactivarDosFactoresUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DOS_FACTORES_REPOSITORY_PORT) private readonly dosFactoresRepo: DosFactoresRepositoryPort,
    @Inject(ValidadorCodigoDosFactoresService) private readonly validador: ValidadorCodigoDosFactoresService,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async execute(req: DesactivarDosFactoresRequest): Promise<Result<void, DomainError>> {
    const usuario = await this.usuarioRepo.findById(req.usuarioId);
    if (!usuario || !usuario.puedeAutenticarse()) {
      return Result.fail(new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO));
    }

    const roles = await this.usuarioRepo.getRolesByUsuarioId(usuario.id);
    if (requiereDosFactores(roles)) {
      return Result.fail(new ForbiddenError('Su rol exige mantener activa la verificación en dos pasos'));
    }
    if (!usuario.twoFactorHabilitado) {
      return Result.fail(new ValidationError('La verificación en dos pasos no está activada'));
    }

    const passwordValida = await argon2.verify(usuario.passwordHash, req.password);
    const metodo = passwordValida ? await this.validador.validar(usuario, req.codigo.trim(), false) : null;
    if (!metodo) {
      await this.validador.registrarFallo(usuario, 'DESACTIVAR_2FA_FALLIDO', req);
      return Result.fail(new UnauthorizedError('Contraseña o código de verificación incorrectos'));
    }

    await this.dosFactoresRepo.reiniciar(usuario.id);
    await this.auditoria.registrar({
      emailUsuario: usuario.email,
      accion: 'DESACTIVAR_2FA',
      resultado: 'EXITOSO',
      usuarioId: usuario.id,
      ipOrigen: req.ipOrigen,
      userAgent: req.userAgent,
    });

    return Result.ok();
  }
}
