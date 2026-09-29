export const DOS_FACTORES_REPOSITORY_PORT = Symbol('DosFactoresRepositoryPort');

export interface CodigoRespaldoVigente {
  id: string;
  codigoHash: string;
}

export interface DosFactoresRepositoryPort {
  guardarSecretoPendiente(usuarioId: string, secretoCifrado: string): Promise<void>;
  activar(usuarioId: string, paso: number, hashesCodigosRespaldo: string[]): Promise<void>;
  reiniciar(usuarioId: string): Promise<void>;
  registrarPasoSiEsNuevo(usuarioId: string, paso: number): Promise<boolean>;
  obtenerCodigosRespaldoVigentes(usuarioId: string): Promise<CodigoRespaldoVigente[]>;
  consumirCodigoRespaldo(codigoId: string): Promise<boolean>;
}
