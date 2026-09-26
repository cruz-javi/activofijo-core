import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().optional().default('web-browser'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().optional().default('web-browser'),
});

export type RefreshDto = z.infer<typeof RefreshSchema>;
