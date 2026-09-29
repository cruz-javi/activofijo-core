export const CODIGOS_RESPALDO_PORT = Symbol('CodigosRespaldoPort');

export interface CodigosRespaldoGenerados {
  codigosPlano: string[];
  hashes: string[];
}

export interface CodigosRespaldoPort {
  generar(cantidad?: number): Promise<CodigosRespaldoGenerados>;
  verificar(codigoIngresado: string, hash: string): Promise<boolean>;
}
