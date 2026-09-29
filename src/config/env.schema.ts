import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATA_SOURCE_MODE: z.enum(['fresh', 'legacy', 'hybrid']).default('fresh'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_DATABASE_URL: z.string().optional(),
  LEGACY_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_2FA_SECRET: z.string().min(32, 'JWT_2FA_SECRET must be at least 32 characters long'),
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOTP_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters'),
  TOTP_ISSUER: z.string().min(1).default('UAGRM Activo Fijo'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  TRUST_PROXY: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@uagrm.edu.bo'),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).default('AdminPass2026!'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Environment validation failed: ${errorDetails}`);
  }
  return parsed.data;
}
