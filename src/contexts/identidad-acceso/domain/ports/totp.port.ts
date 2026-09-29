export const TOTP_PORT = Symbol('TotpPort');

export interface ResultadoVerificacionTotp {
  valido: boolean;
  paso?: number;
}

export interface TotpPort {
  generarSecreto(): string;
  generarUriOtpauth(emailUsuario: string, secreto: string): string;
  verificar(secreto: string, codigo: string, ultimoPasoAceptado?: number | null): Promise<ResultadoVerificacionTotp>;
}
