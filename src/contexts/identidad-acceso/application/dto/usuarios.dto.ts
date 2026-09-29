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
  rol: z.string().min(2).default('FUNCIONARIO'),
  cargoInstitucional: z.string().optional(),
  codigoEmpleadoLegado: z.number().int().positive().optional(),
});

export type CreateUsuarioDto = z.infer<typeof CreateUsuarioSchema>;

export const UpdateUsuarioSchema = z
  .object({
    rol: z.string().min(2).optional(),
    roles: z.array(z.string()).optional(),
    activo: z.boolean().optional(),
    estado: z.string().optional(),
  })
  .refine((data) => data.rol !== undefined || data.roles !== undefined || data.activo !== undefined || data.estado !== undefined, {
    message: 'Debe indicar al menos un campo a actualizar (rol, roles, activo o estado)',
  });

export type UpdateUsuarioDto = z.infer<typeof UpdateUsuarioSchema>;
