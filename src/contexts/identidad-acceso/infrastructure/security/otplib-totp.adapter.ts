import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import { TotpPort, ResultadoVerificacionTotp } from '../../domain/ports/totp.port.js';

const FORMATO_CODIGO_TOTP = /^\d{6}$/;
const PERIODO_SEGUNDOS = 30;
const TOLERANCIA_SEGUNDOS = PERIODO_SEGUNDOS;

@Injectable()
export class OtplibTotpAdapter implements TotpPort {
  generarSecreto(): string {
    return generateSecret();
  }

  generarUriOtpauth(emailUsuario: string, secreto: string): string {
    return generateURI({
      issuer: process.env.TOTP_ISSUER ?? 'UAGRM Activo Fijo',
      label: emailUsuario,
      secret: secreto,
    });
  }

  // afterTimeStep descarta cualquier código de un paso igual o anterior al último aceptado (anti-repetición, RFC 6238 §5.2).
  async verificar(
    secreto: string,
    codigo: string,
    ultimoPasoAceptado?: number | null,
  ): Promise<ResultadoVerificacionTotp> {
    if (!FORMATO_CODIGO_TOTP.test(codigo)) {
      return { valido: false };
    }

    const ahora = Math.floor(Date.now() / 1000);
    const resultado = await verify({
      secret: secreto,
      token: codigo,
      epoch: ahora,
      epochTolerance: TOLERANCIA_SEGUNDOS,
      ...(ultimoPasoAceptado != null ? { afterTimeStep: ultimoPasoAceptado } : {}),
    });

    return resultado.valid
      ? { valido: true, paso: Math.floor(ahora / PERIODO_SEGUNDOS) + resultado.delta }
      : { valido: false };
  }
}
