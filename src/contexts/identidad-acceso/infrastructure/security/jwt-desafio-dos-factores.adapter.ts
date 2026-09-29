import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DesafioDosFactoresPort,
  FaseDesafio,
  IdentidadConfiguracion,
  IdentidadResuelta,
  PayloadDesafio,
} from '../../domain/ports/desafio-dos-factores.port.js';

const VIGENCIA_DESAFIO = '5m';

// Se firma con un secreto distinto de JWT_SECRET: JwtAuthGuard lo rechaza como credencial de API.
@Injectable()
export class JwtDesafioDosFactoresAdapter implements DesafioDosFactoresPort {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async emitir(usuarioId: string, fase: FaseDesafio, deviceId: string): Promise<string> {
    const payload: PayloadDesafio = { sub: usuarioId, purpose: '2fa', fase, deviceId };
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_2FA_SECRET,
      algorithm: 'HS256',
      expiresIn: VIGENCIA_DESAFIO,
    });
  }

  async validar(token: string, faseEsperada: FaseDesafio): Promise<PayloadDesafio | null> {
    try {
      const payload = await this.jwtService.verifyAsync<PayloadDesafio>(token, {
        secret: process.env.JWT_2FA_SECRET,
        algorithms: ['HS256'],
      });
      return payload.purpose === '2fa' && payload.fase === faseEsperada ? payload : null;
    } catch {
      return null;
    }
  }

  async resolverIdentidad(identidad: IdentidadConfiguracion): Promise<IdentidadResuelta | null> {
    if ('usuarioId' in identidad) {
      return { usuarioId: identidad.usuarioId, viaDesafio: false };
    }
    const payload = await this.validar(identidad.desafioToken, 'configurar');
    return payload ? { usuarioId: payload.sub, deviceId: payload.deviceId, viaDesafio: true } : null;
  }
}
