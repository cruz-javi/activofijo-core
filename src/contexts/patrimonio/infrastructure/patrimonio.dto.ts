import { z } from 'zod';

export const CreateActivoSchema = z.object({
  // Identificación canónica
  codigo: z.string().min(2, 'El código de activo es requerido'),
  descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  monto: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0').default(0),
  valor: z.coerce.number().min(0).optional(), // retrocompatibilidad

  // Cabecera institucional AnzioWin
  nroActivo: z.coerce.number().optional().nullable(),
  codGest: z.coerce.number().optional().nullable(),
  nroIngreso: z.string().optional().nullable(),
  codOfic: z.coerce.number().optional().nullable(),
  ubicacion: z.string().optional(),
  codGrupo: z.coerce.number().optional().nullable(),
  grupoContable: z.string().optional(),
  cSenape: z.string().optional().nullable(),
  nInt: z.string().optional().nullable(),

  // Datos descriptivos y técnicos
  nroSerie: z.string().optional().nullable(),
  fecAdqui: z.string().optional().nullable(),
  fecGarantia: z.string().optional().nullable(),
  codUnidad: z.coerce.number().optional().nullable(),
  unidad: z.string().optional().nullable(),
  codMarca: z.coerce.number().optional().nullable(),
  codModelo: z.coerce.number().optional().nullable(),
  codProve: z.coerce.number().optional().nullable(),
  codCond: z.coerce.number().optional().nullable(),
  condicion: z.string().optional().nullable(),
  codEstado: z.coerce.number().optional().nullable(),
  estado: z.string().default('BUENO'),

  // Marco legal y procedencia
  recur: z.string().optional().nullable(),
  tipoIng: z.string().optional().nullable(),
  actaRecep: z.string().optional().nullable(),

  // Custodio / asignación inicial
  codEmp: z.coerce.number().optional().nullable(),
  asignadoA: z.string().optional().nullable(),

  // Atributos vehiculares (condicionales)
  esVehiculo: z.boolean().optional().default(false),
  placa: z.string().optional().nullable(),
  chasis: z.string().optional().nullable(),
  motor: z.string().optional().nullable(),
  ruat: z.string().optional().nullable(),
  poliza: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  anioFabricacion: z.coerce.number().optional().nullable(),
  cilindrada: z.string().optional().nullable(),

  // Seguridad y firma de re-autenticación
  passwordConfirm: z.string().min(1, 'La contraseña de confirmación es obligatoria'),
});

export type CreateActivoDto = z.infer<typeof CreateActivoSchema>;

export const UpdateActivoSchema = z.object({
  descripcion: z.string().optional(),
  grupoContable: z.string().optional(),
  ubicacion: z.string().optional(),
  estado: z.string().optional(),
  valor: z.coerce.number().optional(),
  expectedVersion: z.number().int().positive(),
});

export type UpdateActivoDto = z.infer<typeof UpdateActivoSchema>;
