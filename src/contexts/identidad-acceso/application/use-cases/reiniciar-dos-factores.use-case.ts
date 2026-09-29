import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import {
  DOS_FACTORES_REPOSITORY_PORT,
  DosFactoresRepositoryPort,
} from '../../domain/ports/dos-factores-repository.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../../domain/ports/auditoria-acceso.port.js';
import { Result } from '../../../../shared/domain/result.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { MENSAJE_USUARIO_NO_ENCONTRADO } from '../mensajes-autenticacion.constants.js';

export interface ReiniciarDosFactoresRequest {
  usuarioObjetivoId: string;
  ejecutadoPor: { id: string; email: string };
  ipOrigen?: string;
  userAgent?: string;
}

// Recuperación por pérdida del celular: la autorización (solo ADMINISTRADOR) la aplica el controlador.
@Injectable()
export class ReiniciarDosFactoresUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(DOS_FACTORES_REPOSITORY_PORT) private readonly dosFactoresRepo: DosFactoresRepositoryPort,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async execute(req: ReiniciarDosFactoresRequest): Promise<Result<void, NotFoundError>> {
    const objetivo = await this.usuarioRepo.findById(req.usuarioObjetivoId);
    if (!objetivo) {
      return Result.fail(new NotFoundError(MENSAJE_USUARIO_NO_ENCONTRADO));
    }

    await this.dosFactoresRepo.reiniciar(objetivo.id);
    await this.auditoria.registrar({
      emailUsuario: req.ejecutadoPor.email,
      accion: 'REINICIAR_2FA',
      resultado: 'EXITOSO',
      detalle: `Verificación en dos pasos reiniciada para ${objetivo.email}`,
      usuarioId: req.ejecutadoPor.id,
      entidadId: objetivo.id,
      ipOrigen: req.ipOrigen,
      userAgent: req.userAgent,
    });

    return Result.ok();
  }
}
