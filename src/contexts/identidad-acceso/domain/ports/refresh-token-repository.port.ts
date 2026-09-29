export const REFRESH_TOKEN_REPOSITORY_PORT = Symbol('RefreshTokenRepositoryPort');

export interface NuevoRefreshToken {
  tokenHash: string;
  familyId: string;
  usuarioId: string;
  ipCreacion?: string;
  expiraEn: Date;
}

export interface RefreshTokenRepositoryPort {
  crear(token: NuevoRefreshToken): Promise<void>;
}
