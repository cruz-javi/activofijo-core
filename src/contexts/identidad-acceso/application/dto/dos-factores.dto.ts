import { z } from 'zod';

const CODIGO_TOTP = /^\d{6}$/;

export const ConfigurarDosFactoresInicialSchema = z.object({
  desafioToken: z.string().min(1, 'El desafío de verificación es requerido'),
});
export type ConfigurarDosFactoresInicialDto = z.infer<typeof ConfigurarDosFactoresInicialSchema>;

export const ActivarDosFactoresInicialSchema = z.object({
  desafioToken: z.string().min(1, 'El desafío de verificación es requerido'),
  codigo: z.string().trim().regex(CODIGO_TOTP, 'Ingrese el código de 6 dígitos de su aplicación autenticadora'),
});
export type ActivarDosFactoresInicialDto = z.infer<typeof ActivarDosFactoresInicialSchema>;

export const DesactivarDosFactoresSchema = z.object({
  password: z.string().min(1, 'La contraseña es requerida'),
  codigo: z.string().trim().regex(CODIGO_TOTP, 'Ingrese el código de 6 dígitos de su aplicación autenticadora'),
});
export type DesactivarDosFactoresDto = z.infer<typeof DesactivarDosFactoresSchema>;
