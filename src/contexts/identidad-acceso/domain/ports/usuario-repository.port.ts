import { Usuario } from '../entities/usuario.entity.js';

export const USUARIO_REPOSITORY_PORT = Symbol('UsuarioRepositoryPort');

export interface UsuarioRepositoryPort {
  findById(id: string): Promise<Usuario | null>;
  findByEmail(email: string): Promise<Usuario | null>;
  findByIdentificador(identificador: string): Promise<Usuario | null>;
  save(usuario: Usuario): Promise<void>;
  findAll(limit?: number, offset?: number): Promise<Usuario[]>;
  getRolesByUsuarioId(usuarioId: string): Promise<string[]>;
  getPermisosByUsuarioId(usuarioId: string): Promise<string[]>;
  esDosFactoresObligatorioParaUsuario(usuarioId: string): Promise<boolean>;
}
