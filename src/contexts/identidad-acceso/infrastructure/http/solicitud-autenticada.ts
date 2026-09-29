import type { Request } from 'express';

export interface UsuarioAutenticado {
  sub: string;
  email: string;
  roles: string[];
  permisos: string[];
}

export type SolicitudAutenticada = Request & { user: UsuarioAutenticado };

export function obtenerContextoSolicitud(req: Request): { ipOrigen: string; userAgent?: string } {
  return { ipOrigen: req.ip ?? '127.0.0.1', userAgent: req.headers['user-agent'] };
}
