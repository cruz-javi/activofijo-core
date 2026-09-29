import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.LEGACY_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function check() {
  const client = await pool.connect();
  try {
    const schemas = await client.query("SELECT schema_name FROM information_schema.schemata;");
    console.log('Schemas:', schemas.rows.map(r => r.schema_name));

    const tables = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('core', 'legacy_demo', 'public') ORDER BY table_schema, table_name;");
    console.log('Tables:', tables.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
