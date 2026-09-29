import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USUARIO_REPOSITORY_PORT, UsuarioRepositoryPort } from '../../domain/ports/usuario-repository.port.js';
import { Result } from '../../../../shared/domain/result.js';
import { UnauthorizedError } from '../../../../shared/domain/domain-error.js';
import { PrismaCoreService } from '../../../../shared/infrastructure/database/prisma-core.service.js';
import { EventStorePort, EVENT_STORE_PORT } from '../../../trazabilidad/domain/ports/event-store.port.js';
import argon2 from 'argon2';
import crypto from 'crypto';

export interface AutenticarUsuarioRequest {
  identificador?: string;
  email?: string;
  passwordRaw: string;
  deviceId?: string;
  ipOrigen?: string;
}

export interface AutenticarUsuarioResponse {
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

const MENSAJE_BLOQUEO_SEGURIDAD =
  'Usuario bloqueado por conexión sospechosa o múltiples intentos fallidos. Debe consultar personalmente con el Administrador del Sistema para su reactivación.';

@Injectable()
export class AutenticarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY_PORT) private readonly usuarioRepo: UsuarioRepositoryPort,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaCoreService) private readonly prisma: PrismaCoreService,
    @Inject(EVENT_STORE_PORT) private readonly eventStore: EventStorePort,
  ) {}

  async execute(req: AutenticarUsuarioRequest): Promise<Result<AutenticarUsuarioResponse, UnauthorizedError>> {
    const identificador = (req.identificador || req.email || '').trim();
    if (!identificador) {
      return Result.fail(new UnauthorizedError('Debe ingresar su correo o código de funcionario'));
    }

    const usuario = await this.usuarioRepo.findByIdentificador(identificador);

    if (usuario && usuario.estaBloqueado()) {
      await this.registrarAuditoria(
        usuario.email,
        'BLOQUEADO_SEGURIDAD',
        'Intento de autenticación sobre cuenta con bloqueo definitivo',
        usuario.id,
        req.ipOrigen,
      );
      return Result.fail(new UnauthorizedError(MENSAJE_BLOQUEO_SEGURIDAD));
    }

    if (!usuario || !usuario.puedeAutenticarse()) {
      await this.registrarAuditoria(
        identificador,
        'DENEGADO_SIN_PERMISO',
        'Usuario inactivo o no encontrado',
        usuario?.id,
        req.ipOrigen,
      );
      return Result.fail(new UnauthorizedError('Credenciales inválidas'));
    }

    const isValid = await argon2.verify(usuario.passwordHash, req.passwordRaw);
    if (!isValid) {
      usuario.registrarIntentoFallido();
      await this.usuarioRepo.save(usuario);

      if (usuario.estaBloqueado()) {
        await this.registrarAuditoria(
          usuario.email,
          'BLOQUEADO_SEGURIDAD',
          'Bloqueo definitivo activado al alcanzar 5 intentos fallidos consecutivos',
          usuario.id,
          req.ipOrigen,
        );
        return Result.fail(new UnauthorizedError(MENSAJE_BLOQUEO_SEGURIDAD));
      }

      await this.registrarAuditoria(
        usuario.email,
        'DENEGADO_SIN_PERMISO',
        `Contraseña incorrecta (Intento ${usuario.intentosFallidos} de 5)`,
        usuario.id,
        req.ipOrigen,
      );
      return Result.fail(new UnauthorizedError('Credenciales inválidas'));
    }

    usuario.resetearIntentosFallidos();
    await this.usuarioRepo.save(usuario);

    const roles = await this.usuarioRepo.getRolesByUsuarioId(usuario.id);
    const permisos = await this.usuarioRepo.getPermisosByUsuarioId(usuario.id);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: usuario.id,
        email: usuario.email,
        rol: roles[0] || 'FUNCIONARIO',
        roles,
        permisos,
        deviceId: req.deviceId || 'web',
      },
      { secret: process.env.JWT_SECRET, expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any },
    );

    const { rawRefreshToken } = await this.issueRefreshToken(usuario.id, req.deviceId || 'web', req.ipOrigen);

    await this.registrarAuditoria(usuario.email, 'EXITOSO', undefined, usuario.id, req.ipOrigen);

    try {
      await this.eventStore.append({
        streamId: usuario.id,
        streamType: 'AuthUsuario',
        version: 1,
        eventType: 'SesionIniciada',
        payload: { email: usuario.email, deviceId: req.deviceId, timestamp: new Date().toISOString() },
      });
    } catch {
      const events = await this.eventStore.readStream(usuario.id);
      await this.eventStore.append({
        streamId: usuario.id,
        streamType: 'AuthUsuario',
        version: events.length + 1,
        eventType: 'SesionIniciada',
        payload: { email: usuario.email, deviceId: req.deviceId, timestamp: new Date().toISOString() },
      });
    }

    return Result.ok({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombreCompleto,
        cargoInstitucional: usuario.cargoInstitucional,
        codigoEmpleadoLegado: usuario.codigoEmpleadoLegado,
        roles,
        permisos,
      },
    });
  }

  private async issueRefreshToken(usuarioId: string, deviceId: string, ipOrigen?: string) {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const familyId = crypto.randomUUID();
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

  private async registrarAuditoria(
    emailUsuario: string,
    resultado: 'EXITOSO' | 'DENEGADO_SIN_PERMISO' | 'BLOQUEADO_SEGURIDAD',
    detalle?: string,
    usuarioId?: string,
    ipOrigen?: string,
  ) {
    try {
      await this.prisma.authAuditoriaForense.create({
        data: {
          emailUsuario,
          accion: 'LOGIN',
          modulo: 'IDENTIDAD_ACCESO',
          resultado,
          motivoRechazo: detalle,
          usuarioId,
          ipOrigen: ipOrigen || '127.0.0.1',
        },
      });
    } catch (error) {
      console.warn(`No se pudo registrar la auditoría de acceso: ${(error as Error).message}`);
    }
  }
}
