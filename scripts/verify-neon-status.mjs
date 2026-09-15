import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkNeon() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('core', 'legacy_demo')
      ORDER BY table_schema, table_name;
    `);

    console.log('[INFO] Database verified on Neon:');
    for (const row of res.rows) {
      console.log(` - ${row.table_schema}.${row.table_name}`);
    }
  } catch (error) {
    console.error('[ERROR] Neon check failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkNeon();
