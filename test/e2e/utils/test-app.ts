import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

/**
 * Crea una instancia de app aislada con variables de entorno sobreescritas
 * temporalmente. Útil para simular un origen de datos inalcanzable: los
 * servicios Prisma leen `process.env` solo en su constructor y mantienen un
 * `pg.Pool` de larga duración, así que revocar permisos sobre una conexión
 * ya abierta no la afecta — hace falta una app nueva con credenciales/host
 * inválidos desde el arranque.
 */
export async function createTestAppWithEnv(overrides: Record<string, string>): Promise<INestApplication> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  try {
    return await createTestApp();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

export function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
