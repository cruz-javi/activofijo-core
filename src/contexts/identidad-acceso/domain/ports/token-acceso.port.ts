export const TOKEN_ACCESO_PORT = Symbol('TokenAccesoPort');

export interface PayloadTokenAcceso {
  sub: string;
  email: string;
  rol: string;
  roles: string[];
  permisos: string[];
  deviceId: string;
}

export interface TokenAccesoPort {
  firmar(payload: PayloadTokenAcceso): Promise<string>;
}
