export const ROLES_CON_DOS_FACTORES_OBLIGATORIO: readonly string[] = ['ADMINISTRADOR', 'JEFE_ACTIVO_FIJO'];

export function requiereDosFactores(roles: readonly string[]): boolean {
  return roles.some((rol) => ROLES_CON_DOS_FACTORES_OBLIGATORIO.includes(rol.toUpperCase()));
}
