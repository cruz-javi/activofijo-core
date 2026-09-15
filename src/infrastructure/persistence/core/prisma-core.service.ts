import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/client.js';
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
    });

    const adapter = new PrismaPg(pool, { schema: 'core' });
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
