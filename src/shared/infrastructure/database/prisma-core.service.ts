import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/core/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaCoreService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const isSsl = connectionString?.includes('neon.tech') || connectionString?.includes('sslmode=require');
    
    const pool = new pg.Pool({
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      options: '-c timezone=America/La_Paz',
    });

    const adapter = new PrismaPg(pool, { schema: 'core' });
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE core.auth_rol 
        ADD COLUMN IF NOT EXISTS requiere_dos_pasos BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await this.$executeRawUnsafe(`
        UPDATE core.auth_rol 
        SET requiere_dos_pasos = TRUE 
        WHERE id IN ('ADMINISTRADOR', 'JEFE_ACTIVO_FIJO');
      `);
    } catch (e) {
      console.warn('Verificación columna requiere_dos_pasos:', e);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
