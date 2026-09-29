import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenAccesoPort, PayloadTokenAcceso } from '../../domain/ports/token-acceso.port.js';
import { opcionesFirmaAcceso } from './jwt-options.js';

@Injectable()
export class JwtTokenAccesoAdapter implements TokenAccesoPort {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  firmar(payload: PayloadTokenAcceso): Promise<string> {
    return this.jwtService.signAsync({ ...payload }, opcionesFirmaAcceso());
  }
}
