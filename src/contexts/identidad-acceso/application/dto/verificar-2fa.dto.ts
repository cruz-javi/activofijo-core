import { z } from 'zod';

const CODIGO_TOTP = /^\d{6}$/;
const CODIGO_RESPALDO = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;

export const VerificarDosFactoresSchema = z.object({
  desafioToken: z.string().min(1, 'El desafío de verificación es requerido'),
  codigo: z
    .string()
    .trim()
    .refine((valor) => CODIGO_TOTP.test(valor) || CODIGO_RESPALDO.test(valor), {
      message: 'Ingrese el código de 6 dígitos o un código de respaldo válido',
    }),
  deviceId: z.string().optional().default('web-browser'),
});

export type VerificarDosFactoresDto = z.infer<typeof VerificarDosFactoresSchema>;
