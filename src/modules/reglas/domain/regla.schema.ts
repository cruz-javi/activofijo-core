import { z } from 'zod';

// Una regla de depreciación por línea recta: el activo se deprecia en
// partes iguales durante su vida útil, hasta llegar a su valor residual.
export const ReglaDepreciacionSchema = z.object({
  grupoContable: z.string().min(2),
  vidaUtilAnios: z.coerce.number().positive(),
  valorResidualPorcentaje: z.coerce.number().min(0).max(100).default(0),
});

export type ReglaDepreciacion = z.infer<typeof ReglaDepreciacionSchema>;

export const ConfiguracionReglasInputSchema = z.object({
  reglas: z.array(ReglaDepreciacionSchema).min(1),
  reglaPorDefecto: ReglaDepreciacionSchema.omit({ grupoContable: true }).optional(),
  resolucion: z.string().min(3),
  descripcion: z.string().optional(),
});

export type ConfiguracionReglasInput = z.infer<typeof ConfiguracionReglasInputSchema>;
