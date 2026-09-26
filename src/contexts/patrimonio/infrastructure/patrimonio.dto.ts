import { z } from 'zod';

export const CreateActivoSchema = z.object({
  codigo: z.string().min(3),
  descripcion: z.string().min(3),
  grupoContable: z.string().min(2),
  ubicacion: z.string().min(2),
  estado: z.string().default('BUENO'),
  valor: z.coerce.number().min(0),
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
