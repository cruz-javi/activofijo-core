export const AUDITORIA_ACCESO_PORT = Symbol('AuditoriaAccesoPort');

export interface RegistroAuditoriaAcceso {
  emailUsuario: string;
  accion: string;
  resultado: 'EXITOSO' | 'DENEGADO_SIN_PERMISO' | 'BLOQUEADO_SEGURIDAD';
  detalle?: string;
  usuarioId?: string;
  ipOrigen?: string;
  userAgent?: string;
  entidadId?: string;
}

export interface AuditoriaAccesoPort {
  registrar(registro: RegistroAuditoriaAcceso): Promise<void>;
}
