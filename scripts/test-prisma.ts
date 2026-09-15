import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from './../src/infrastructure/persistence/core/generated/client.js';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const adapter = new PrismaPg(pool, { schema: 'core' });
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.activoProyeccion.count();
    console.log('[INFO] ActivoProyeccion count via Prisma 7:', count);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
