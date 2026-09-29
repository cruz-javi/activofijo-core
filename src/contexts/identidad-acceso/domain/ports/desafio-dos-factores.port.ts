export const DESAFIO_DOS_FACTORES_PORT = Symbol('DesafioDosFactoresPort');

export type FaseDesafio = 'verificar' | 'configurar';

export interface PayloadDesafio {
  sub: string;
  purpose: '2fa';
  fase: FaseDesafio;
  deviceId: string;
}

export type IdentidadConfiguracion = { usuarioId: string } | { desafioToken: string };

export interface IdentidadResuelta {
  usuarioId: string;
  deviceId?: string;
  viaDesafio: boolean;
}

export interface DesafioDosFactoresPort {
  emitir(usuarioId: string, fase: FaseDesafio, deviceId: string): Promise<string>;
  validar(token: string, faseEsperada: FaseDesafio): Promise<PayloadDesafio | null>;
  resolverIdentidad(identidad: IdentidadConfiguracion): Promise<IdentidadResuelta | null>;
}
