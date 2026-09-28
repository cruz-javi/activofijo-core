import { z } from 'zod';

export const GenerarEtiquetasLoteSchema = z.object({
  codigos: z.array(z.string().min(1)).min(1, 'Debe proporcionar al menos un código de activo'),
  plantillaId: z.string().optional(),
  formato: z.enum(['QR', 'CODE128', 'HIBRIDO']).optional().default('HIBRIDO'),
  motivo: z.enum(['ALTA', 'REPOSICION', 'REIMPRESION']).optional().default('ALTA'),
  impresoraDestino: z.string().optional(),
});

export type GenerarEtiquetasLoteDto = z.infer<typeof GenerarEtiquetasLoteSchema>;

export const ReponerEtiquetaSchema = z.object({
  codActivo: z.string().min(1, 'Debe especificar el código del bien a reponer'),
  motivo: z.enum([
    'DETERIORO_FISICO',
    'CODIGO_ILEGIBLE',
    'DESPRENDIMIENTO',
    'REEMPLAZO_PREVENTIVO',
    'ACTUALIZACION_FORMATO',
    'OTRO',
  ]),
  observacion: z.string().optional(),
  plantillaId: z.string().optional(),
  formato: z.enum(['QR', 'CODE128', 'HIBRIDO']).optional().default('HIBRIDO'),
});

export type ReponerEtiquetaDto = z.infer<typeof ReponerEtiquetaSchema>;

export const ElementosConfigSchema = z.object({
  showLogo: z.boolean().default(true),
  showInstitucion: z.boolean().default(true),
  textoInstitucion: z.string().default('U.A.G.R.M. - ACTIVO FIJO'),
  showCodigoTexto: z.boolean().default(true),
  showDescripcion: z.boolean().default(true),
  showCustodio: z.boolean().default(false),
  showOficina: z.boolean().default(true),
  showFecha: z.boolean().default(false),
  showHashSeguridad: z.boolean().default(true),
  showBordeCorte: z.boolean().default(true),
  tamanoFuente: z.enum(['pequeno', 'medio', 'grande']).default('medio'),
  orientacion: z.enum(['horizontal', 'vertical']).default('horizontal'),
});

export type ElementosConfig = z.infer<typeof ElementosConfigSchema>;

export const CrearPlantillaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(80),
  descripcion: z.string().max(200).optional(),
  tipoPapel: z.enum(['ROLLO_TERMICO', 'HOJA_A4', 'INDIVIDUAL']),
  anchoMm: z.number().positive('El ancho en milímetros debe ser mayor a 0'),
  altoMm: z.number().positive('El alto en milímetros debe ser mayor a 0'),
  columnas: z.number().int().min(1).default(1),
  filas: z.number().int().min(1).default(1),
  tipoCodigo: z.enum(['QR', 'BARCODE_128', 'HIBRIDO']),
  configuracion: ElementosConfigSchema,
  esPredeterminada: z.boolean().optional().default(false),
});

export type CrearPlantillaDto = z.infer<typeof CrearPlantillaSchema>;

export const ActualizarPlantillaSchema = CrearPlantillaSchema.partial();
export type ActualizarPlantillaDto = z.infer<typeof ActualizarPlantillaSchema>;
