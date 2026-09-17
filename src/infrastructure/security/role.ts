export const ROLES = ['ADMIN', 'OFICINA', 'CAMPO'] as const;

export type Role = (typeof ROLES)[number];
