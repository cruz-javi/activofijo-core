import { Injectable, Inject, Optional } from '@nestjs/common';
import crypto from 'crypto';
import { SecretoCifradoPort } from '../../domain/ports/secreto-cifrado.port.js';

export const CLAVE_CIFRADO_TOTP = Symbol('CLAVE_CIFRADO_TOTP');

const VERSION = 'v1';
const LONGITUD_IV_BYTES = 12;
const LONGITUD_CLAVE_HEX = 64;

// AES-256-GCM: el secreto TOTP nunca se guarda en claro; la etiqueta de autenticación detecta manipulación.
@Injectable()
export class AesGcmSecretoCifradoAdapter implements SecretoCifradoPort {
  constructor(@Optional() @Inject(CLAVE_CIFRADO_TOTP) private readonly claveHex?: string) {}

  cifrar(secreto: string): string {
    const iv = crypto.randomBytes(LONGITUD_IV_BYTES);
    const cifrador = crypto.createCipheriv('aes-256-gcm', this.obtenerClave(), iv);
    const cifrado = Buffer.concat([cifrador.update(secreto, 'utf8'), cifrador.final()]);
    const etiqueta = cifrador.getAuthTag();

    return [VERSION, iv.toString('base64'), etiqueta.toString('base64'), cifrado.toString('base64')].join(':');
  }

  descifrar(valorCifrado: string): string {
    const [version, iv, etiqueta, cifrado] = valorCifrado.split(':');
    if (version !== VERSION || !iv || !etiqueta || !cifrado) {
      throw new Error('Formato de secreto TOTP cifrado no reconocido');
    }

    const descifrador = crypto.createDecipheriv('aes-256-gcm', this.obtenerClave(), Buffer.from(iv, 'base64'));
    descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));

    return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64')), descifrador.final()]).toString('utf8');
  }

  private obtenerClave(): Buffer {
    const clave = this.claveHex ?? process.env.TOTP_ENCRYPTION_KEY;
    if (!clave || clave.length !== LONGITUD_CLAVE_HEX) {
      throw new Error('TOTP_ENCRYPTION_KEY debe ser de 32 bytes en formato hexadecimal');
    }
    return Buffer.from(clave, 'hex');
  }
}
