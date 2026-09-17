import { z } from 'zod';

const institutionalEmail = z
  .string()
  .email()
  .refine((email) => email.toLowerCase().endsWith('@uagrm.edu.bo'), {
    message: 'El correo debe ser institucional (@uagrm.edu.bo)',
  });

export const CreateUsuarioSchema = z.object({
  nombre: z.string().min(3),
  email: institutionalEmail,
  password: z.string().min(8),
  rol: z.enum(['ADMIN', 'OFICINA', 'CAMPO']),
});

export type CreateUsuarioDto = z.infer<typeof CreateUsuarioSchema>;

export const UpdateUsuarioSchema = z
  .object({
    rol: z.enum(['ADMIN', 'OFICINA', 'CAMPO']).optional(),
    activo: z.boolean().optional(),
  })
  .refine((data) => data.rol !== undefined || data.activo !== undefined, {
    message: 'Debe indicar al menos un campo a actualizar (rol o activo)',
  });

export type UpdateUsuarioDto = z.infer<typeof UpdateUsuarioSchema>;
