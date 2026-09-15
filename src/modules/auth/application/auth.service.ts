import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaCoreService } from '../../../infrastructure/persistence/core/prisma-core.service.js';
import { EventStoreService } from '../../../infrastructure/event-store/event-store.service.js';
import argon2 from 'argon2';
import crypto from 'crypto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaCoreService,
    private readonly jwtService: JwtService,
    private readonly eventStore: EventStoreService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.usuario.count();
    if (count === 0) {
      const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@uagrm.edu.bo';
      const password = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPass2026!';
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });

      await this.prisma.usuario.create({
        data: {
          email,
          passwordHash,
          nombre: 'Administrador General UAGRM',
          rol: 'ADMIN',
        },
      });
      this.logger.log(`Initialized default administrator user: ${email}`);
    }
  }

  async login(email: string, password: string, deviceId = 'web-browser') {
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.signAccessToken(user.id, user.email, user.rol, deviceId);
    const { rawRefreshToken, familyId } = await this.issueRefreshToken(user.id, deviceId);

    // Record session event in event store
    try {
      await this.eventStore.append({
        streamId: user.id,
        streamType: 'Usuario',
        version: 1,
        eventType: 'SesionIniciada',
        payload: { email: user.email, deviceId, timestamp: new Date().toISOString() },
      });
    } catch {
      // Append if version already exists
      const events = await this.eventStore.readStream(user.id);
      await this.eventStore.append({
        streamId: user.id,
        streamType: 'Usuario',
        version: events.length + 1,
        eventType: 'SesionIniciada',
        payload: { email: user.email, deviceId, timestamp: new Date().toISOString() },
      });
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
      },
    };
  }

  async refresh(rawToken: string, deviceId = 'web-browser') {
    const tokenHash = this.hashToken(rawToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (tokenRecord.revoked) {
      // Reuse detected: revoke entire family
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Compromised refresh token reused. Family revoked.');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke used token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    // Issue new token in same family
    const accessToken = await this.signAccessToken(
      tokenRecord.usuario.id,
      tokenRecord.usuario.email,
      tokenRecord.usuario.rol,
      deviceId,
    );
    const { rawRefreshToken } = await this.issueRefreshToken(
      tokenRecord.usuario.id,
      deviceId,
      tokenRecord.familyId,
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: tokenRecord.usuario.id,
        email: tokenRecord.usuario.email,
        nombre: tokenRecord.usuario.nombre,
        rol: tokenRecord.usuario.rol,
      },
    };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (tokenRecord) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revoked: true },
      });
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nombre: true, rol: true, activo: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private async signAccessToken(userId: string, email: string, rol: string, deviceId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, rol, deviceId },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
      },
    );
  }

  private async issueRefreshToken(userId: string, deviceId: string, existingFamilyId?: string) {
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = existingFamilyId || crypto.randomUUID();
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        familyId,
        userId,
        deviceId,
        expiresAt,
      },
    });

    return { rawRefreshToken, familyId };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
