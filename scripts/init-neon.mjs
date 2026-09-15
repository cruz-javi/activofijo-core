import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[ERROR] DIRECT_DATABASE_URL or DATABASE_URL is not set.');
  process.exit(1);
}

async function runBootstrap() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[INFO] Connected to PostgreSQL target');

    const sqlPath = path.resolve('scripts/01-bootstrap.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('[INFO] Executing 01-bootstrap.sql');
    await client.query(sql);
    console.log('[INFO] Bootstrap SQL executed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Bootstrap failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runBootstrap();
