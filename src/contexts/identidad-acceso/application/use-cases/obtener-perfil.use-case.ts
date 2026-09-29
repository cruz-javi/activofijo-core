import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { requiereDosFactores } from '../../domain/services/politica-dos-factores.service.js';
import { Result } from '../../../../shared/domain/result.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';

export interface ObtenerPerfilResponse {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  permisos: string[];
  activo: boolean;
  dosFactoresActivo: boolean;
  dosFactoresObligatorio: boolean;
}

@Injectable()
export class ObtenerPerfilUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  async execute(usuarioId: string): Promise<Result<ObtenerPerfilResponse, NotFoundError>> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) {
      return Result.fail(new NotFoundError('Usuario no encontrado'));
    }

    const roles = await this.usuarioRepo.getRolesByUsuarioId(usuarioId);
    const permisos = await this.usuarioRepo.getPermisosByUsuarioId(usuarioId);

    return Result.ok({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombreCompleto,
      roles,
      permisos,
      activo: usuario.activo,
      dosFactoresActivo: usuario.twoFactorHabilitado,
      dosFactoresObligatorio: requiereDosFactores(roles),
    });
  }
}
