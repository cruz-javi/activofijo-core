export const SECRETO_CIFRADO_PORT = Symbol('SecretoCifradoPort');

export interface SecretoCifradoPort {
  cifrar(secreto: string): string;
  descifrar(valorCifrado: string): string;
}
