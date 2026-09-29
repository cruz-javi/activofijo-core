import { Injectable, Inject } from '@nestjs/common';
import crypto from 'crypto';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../domain/ports/usuario-repository.port.js';
import { TOKEN_ACCESO_PORT, TokenAccesoPort } from '../domain/ports/token-acceso.port.js';
import {
  REFRESH_TOKEN_REPOSITORY_PORT,
  RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port.js';
import { AUDITORIA_ACCESO_PORT, AuditoriaAccesoPort } from '../domain/ports/auditoria-acceso.port.js';
import { Usuario } from '../domain/entities/usuario.entity.js';
import { EventStorePort, EVENT_STORE_PORT } from '../../trazabilidad/domain/ports/event-store.port.js';

export interface SesionIniciada {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nombre: string;
    cargoInstitucional?: string | null;
    codigoEmpleadoLegado?: number | null;
    roles: string[];
    permisos: string[];
  };
}

export interface ContextoSesion {
  deviceId: string;
  ipOrigen?: string;
  roles?: string[];
}

const ROL_POR_DEFECTO = 'FUNCIONARIO';

@Injectable()
export class EmisorSesionService {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(TOKEN_ACCESO_PORT) private readonly tokenAcceso: TokenAccesoPort,
    @Inject(REFRESH_TOKEN_REPOSITORY_PORT) private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(EVENT_STORE_PORT) private readonly eventStore: EventStorePort,
    @Inject(AUDITORIA_ACCESO_PORT) private readonly auditoria: AuditoriaAccesoPort,
  ) {}

  async emitir(usuario: Usuario, contexto: ContextoSesion): Promise<SesionIniciada> {
    usuario.resetearIntentosFallidos();
    await this.usuarioRepo.save(usuario);

    const roles = contexto.roles ?? (await this.usuarioRepo.getRolesByUsuarioId(usuario.id));
    const permisos = await this.usuarioRepo.getPermisosByUsuarioId(usuario.id);

    const accessToken = await this.tokenAcceso.firmar({
      sub: usuario.id,
      email: usuario.email,
      rol: roles[0] || ROL_POR_DEFECTO,
      roles,
      permisos,
      deviceId: contexto.deviceId,
    });
    const refreshToken = await this.emitirRefreshToken(usuario.id, contexto.ipOrigen);

    await this.auditoria.registrar({
      emailUsuario: usuario.email,
      accion: 'LOGIN',
      resultado: 'EXITOSO',
      usuarioId: usuario.id,
      ipOrigen: contexto.ipOrigen,
    });
    await this.registrarEventoSesion(usuario, contexto.deviceId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombreCompleto,
        cargoInstitucional: usuario.cargoInstitucional,
        codigoEmpleadoLegado: usuario.codigoEmpleadoLegado,
        roles,
        permisos,
      },
    };
  }

  private async emitirRefreshToken(usuarioId: string, ipOrigen?: string): Promise<string> {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const dias = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

    await this.refreshTokens.crear({
      tokenHash: crypto.createHash('sha256').update(rawRefreshToken).digest('hex'),
      familyId: crypto.randomUUID(),
      usuarioId,
      ipCreacion: ipOrigen,
      expiraEn: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    });

    return rawRefreshToken;
  }

  private async registrarEventoSesion(usuario: Usuario, deviceId: string): Promise<void> {
    const evento = (version: number) => ({
      streamId: usuario.id,
      streamType: 'AuthUsuario',
      version,
      eventType: 'SesionIniciada',
      payload: { email: usuario.email, deviceId, timestamp: new Date().toISOString() },
    });

    try {
      await this.eventStore.append(evento(1));
    } catch {
      const eventos = await this.eventStore.readStream(usuario.id);
      await this.eventStore.append(evento(eventos.length + 1));
    }
  }
}
