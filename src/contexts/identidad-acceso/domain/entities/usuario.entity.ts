export interface UsuarioProps {
  id: string;
  email: string;
  passwordHash: string;
  nombreCompleto: string;
  cargoInstitucional?: string | null;
  estado: 'ACTIVO' | 'BLOQUEADO_INTENTOS' | 'INACTIVO' | 'SUSPENDIDO_AUDITORIA';
  intentosFallidos: number;
  bloqueadoHasta?: Date | null;
  codigoEmpleadoLegado?: number | null;
  activo: boolean;
}

export class Usuario {
  private constructor(private readonly props: UsuarioProps) {}

  public get id(): string { return this.props.id; }
  public get email(): string { return this.props.email; }
  public get passwordHash(): string { return this.props.passwordHash; }
  public get nombreCompleto(): string { return this.props.nombreCompleto; }
  public get cargoInstitucional(): string | null | undefined { return this.props.cargoInstitucional; }
  public get estado(): string { return this.props.estado; }
  public get intentosFallidos(): number { return this.props.intentosFallidos; }
  public get bloqueadoHasta(): Date | null | undefined { return this.props.bloqueadoHasta; }
  public get codigoEmpleadoLegado(): number | null | undefined { return this.props.codigoEmpleadoLegado; }
  public get activo(): boolean { return this.props.activo; }

  public static create(props: UsuarioProps): Usuario {
    return new Usuario(props);
  }

  public registrarIntentoFallido(): void {
    this.props.intentosFallidos += 1;
    if (this.props.intentosFallidos >= 5) {
      this.props.estado = 'BLOQUEADO_INTENTOS';
      // Bloquear por 15 minutos
      this.props.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  public resetearIntentosFallidos(): void {
    this.props.intentosFallidos = 0;
    this.props.estado = 'ACTIVO';
    this.props.bloqueadoHasta = null;
  }

  public puedeAutenticarse(): boolean {
    if (!this.props.activo || this.props.estado === 'INACTIVO' || this.props.estado === 'SUSPENDIDO_AUDITORIA') {
      return false;
    }
    if (this.props.estado === 'BLOQUEADO_INTENTOS' && this.props.bloqueadoHasta) {
      if (new Date() < this.props.bloqueadoHasta) {
        return false;
      }
      // El bloqueo expiró
      this.resetearIntentosFallidos();
      return true;
    }
    return true;
  }

  public update(props: Partial<Omit<UsuarioProps, 'id' | 'email' | 'passwordHash'>>): void {
    Object.assign(this.props, props);
  }
}
