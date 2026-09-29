import { z } from 'zod';

export const ActivarDosFactoresSchema = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/, 'Ingrese el código de 6 dígitos de su aplicación autenticadora'),
});

export type ActivarDosFactoresDto = z.infer<typeof ActivarDosFactoresSchema>;
