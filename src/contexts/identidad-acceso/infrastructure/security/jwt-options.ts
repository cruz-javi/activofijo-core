import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';

export const JWT_ALGORITMO = 'HS256';
export const JWT_EMISOR = 'activofijo-core';
export const JWT_AUDIENCIA = 'activofijo-clients';

// Firma y verificación viven aquí para que ningún sitio acepte un algoritmo, emisor o audiencia distintos.
export function opcionesFirmaAcceso(): JwtSignOptions {
  return {
    secret: process.env.JWT_SECRET,
    algorithm: JWT_ALGORITMO,
    issuer: JWT_EMISOR,
    audience: JWT_AUDIENCIA,
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as JwtSignOptions['expiresIn'],
  };
}

export function opcionesVerificacionAcceso(): JwtVerifyOptions {
  return {
    secret: process.env.JWT_SECRET,
    algorithms: [JWT_ALGORITMO],
    issuer: JWT_EMISOR,
    audience: JWT_AUDIENCIA,
  };
}
