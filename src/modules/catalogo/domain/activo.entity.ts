export interface ActivoProps {
  id: string;
  codigo: string;
  descripcion: string;
  grupoContable: string;
  ubicacion: string;
  estado: string;
  valor: number;
  fechaAlta: Date;
  version: number;
}

export class Activo {
  private props: ActivoProps;

  constructor(props: ActivoProps) {
    this.props = props;
  }

  get id(): string { return this.props.id; }
  get codigo(): string { return this.props.codigo; }
  get descripcion(): string { return this.props.descripcion; }
  get grupoContable(): string { return this.props.grupoContable; }
  get ubicacion(): string { return this.props.ubicacion; }
  get estado(): string { return this.props.estado; }
  get valor(): number { return this.props.valor; }
  get fechaAlta(): Date { return this.props.fechaAlta; }
  get version(): number { return this.props.version; }

  static create(props: Omit<ActivoProps, 'version'>): Activo {
    return new Activo({
      ...props,
      version: 1,
    });
  }

  update(fields: Partial<Pick<ActivoProps, 'descripcion' | 'grupoContable' | 'ubicacion' | 'estado' | 'valor'>>): void {
    if (this.props.estado === 'BAJA') {
      throw new Error('Cannot modify an asset that has been decommissioned');
    }
    this.props = {
      ...this.props,
      ...fields,
      version: this.props.version + 1,
    };
  }

  darDeBaja(): void {
    if (this.props.estado === 'BAJA') {
      throw new Error('Asset is already decommissioned');
    }
    this.props.estado = 'BAJA';
    this.props.version += 1;
  }

  toJSON(): ActivoProps {
    return { ...this.props };
  }
}
