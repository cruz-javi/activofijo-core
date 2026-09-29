import { z } from 'zod';

export const LoginSchema = z.object({
  identificador: z.string().trim().min(1).optional(),
  email: z.string().trim().optional(),
  password: z.string().min(1, 'La contraseña es requerida'),
  deviceId: z.string().optional().default('web-browser'),
}).refine((data) => Boolean(data.identificador || data.email), {
  message: 'Debe ingresar su correo institucional o código de funcionario',
  path: ['identificador'],
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().optional().default('web-browser'),
});

export type RefreshDto = z.infer<typeof RefreshSchema>;
