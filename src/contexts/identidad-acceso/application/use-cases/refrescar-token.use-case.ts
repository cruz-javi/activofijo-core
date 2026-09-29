import { Injectable, Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { Result } from '../../../../shared/domain/result.js';
import { UnauthorizedError } from '../../../../shared/domain/domain-error.js';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { TOKEN_ACCESO_PORT, TokenAccesoPort } from '../../domain/ports/token-acceso.port.js';
import crypto from 'crypto';

export interface RefrescarTokenRequest {
  rawToken: string;
  deviceId?: string;
  ipOrigen?: string;
}

export interface RefrescarTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nombre: string;
    roles: string[];
    permisos: string[];
  };
}

@Injectable()
export class RefrescarTokenUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(TOKEN_ACCESO_PORT) private readonly tokenAcceso: TokenAccesoPort,
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
  ) {}

  async execute(req: RefrescarTokenRequest): Promise<Result<RefrescarTokenResponse, UnauthorizedError>> {
    const tokenHash = crypto.createHash('sha256').update(req.rawToken).digest('hex');
    
    const tokenRecord = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      return Result.fail(new UnauthorizedError('Refresh token no encontrado'));
    }

    if (tokenRecord.revocado) {
      // Intento de re-uso detectado. Revocar familia entera.
      await this.prisma.authRefreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revocado: true, reemplazadoPor: 'COMPROMETIDO' },
      });
      return Result.fail(new UnauthorizedError('Refresh token comprometido reutilizado. Familia revocada.'));
    }

    if (new Date() > tokenRecord.expiraEn) {
      return Result.fail(new UnauthorizedError('Refresh token expirado'));
    }

    const usuario = await this.usuarioRepo.findById(tokenRecord.usuarioId);
    if (!usuario || !usuario.puedeAutenticarse()) {
      return Result.fail(new UnauthorizedError('Usuario inactivo o no encontrado'));
    }

    // Revocar token actual
    await this.prisma.authRefreshToken.update({
      where: { id: tokenRecord.id },
      data: { revocado: true, reemplazadoPor: 'USO_NORMAL' },
    });

    const roles = await this.usuarioRepo.getRolesByUsuarioId(usuario.id);
    const permisos = await this.usuarioRepo.getPermisosByUsuarioId(usuario.id);

    const accessToken = await this.tokenAcceso.firmar({
      sub: usuario.id,
      email: usuario.email,
      rol: roles[0] || 'FUNCIONARIO',
      roles,
      permisos,
      deviceId: req.deviceId || 'web',
    });

    const { rawRefreshToken } = await this.issueRefreshToken(usuario.id, tokenRecord.familyId, req.deviceId || 'web', req.ipOrigen);

    return Result.ok({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombreCompleto,
        roles,
        permisos,
      },
    });
  }

  private async issueRefreshToken(usuarioId: string, familyId: string, deviceId: string, ipOrigen?: string) {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
    const expiraEn = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.authRefreshToken.create({
      data: {
        tokenHash,
        familyId,
        usuarioId,
        ipCreacion: ipOrigen,
        expiraEn,
      },
    });

    return { rawRefreshToken, familyId };
  }
}
